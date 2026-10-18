"""Actual built Map downloads through native authority, without installing a Pi."""
import hashlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import zipfile
from pathlib import Path

import pytest

from dev.rebuild import test_legacy_transfer as fixtures
from dev.rebuild.legacy_transfer import capture, import_snapshot, pg
from dev.rebuild.test_legacy_map import running

native = fixtures.native
source = fixtures.source
ROOT = fixtures.ROOT
MAP = (ROOT / json.loads((ROOT / 'projects.json').read_text())['projects']['map']).resolve()


def builder():
    spec = importlib.util.spec_from_file_location('map_distribution_builder', MAP / 'scripts/build-device-distribution.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope='module')
def distribution(tmp_path_factory):
    root = tmp_path_factory.mktemp('map-native-downloads')
    # Exercise the public build command and the real product/player inputs.
    result = subprocess.run([sys.executable, str(MAP / 'scripts/build-device-distribution.py'),
                             '--output', str(root / 'bundle')], cwd=MAP, capture_output=True, check=True)
    path = Path(result.stdout.decode().strip())
    assert path == root / 'bundle/map-downloads.json'
    return path


def test_real_bundle_contents_and_shell_syntax(distribution):
    manifest = json.loads(distribution.read_text())
    assert set(manifest['files']) == {'app.zip', 'install.sh', 'aether-projector-setup.sh',
                                     'aether_player.py', 'aether_setup.py', 'aether_receiver.py'}
    for name, entry in manifest['files'].items():
        path = distribution.parent / name
        with path.open('rb') as stream:
            assert hashlib.file_digest(stream, 'sha256').hexdigest() == entry['sha256']
        assert path.stat().st_size == entry['size']
        assert path.stat().st_mode & 0o077 == 0
        if name.endswith('.sh'):
            subprocess.run(['bash', '-n', str(path)], check=True, capture_output=True)
        if name.endswith('.py'):
            assert path.read_bytes() == (MAP / 'player' / name).read_bytes()
    with zipfile.ZipFile(distribution.parent / 'app.zip') as archive:
        assert archive.read('index.html') == (MAP / 'dist/index.html').read_bytes()
        assert set(archive.namelist()) == {p.relative_to(MAP / 'dist').as_posix() for p in (MAP / 'dist').rglob('*') if p.is_file()}
        assert archive.testzip() is None
    assert '@@AETHER_SERVER_URL@@' in (distribution.parent / 'aether-projector-setup.sh').read_text()


@pytest.mark.parametrize('damage', ['symlink', 'hidden', 'traversal-character', 'oversized', 'missing-index', 'reserved'])
def test_product_builder_refuses_unsafe_build(tmp_path, damage):
    root = tmp_path / 'product'
    (root / 'dist').mkdir(parents=True)
    (root / 'dist/index.html').write_text('<html>Map</html>')
    shutil.copytree(MAP / 'player', root / 'player', ignore=shutil.ignore_patterns('__pycache__', 'tests'))
    (root / 'service/aether_map_service').mkdir(parents=True)
    shutil.copyfile(MAP / 'service/aether_map_service/provisioning.py', root / 'service/aether_map_service/provisioning.py')
    if damage == 'symlink':
        (root / 'dist/link.js').symlink_to(root / 'player/aether_player.py')
    elif damage == 'hidden':
        (root / 'dist/.env').write_text('private')
    elif damage == 'traversal-character':
        (root / 'dist/bad\\name.js').write_text('invalid')
    elif damage == 'reserved':
        (root / 'dist/layout.json').write_text('{}')
    elif damage == 'oversized':
        with (root / 'dist/large.bin').open('wb') as file:
            file.truncate(128 * 1024 * 1024 + 1)
    else:
        (root / 'dist/index.html').unlink()
    with pytest.raises(ValueError):
        builder().build(root, tmp_path / 'bundle')
    assert not (tmp_path / 'bundle').exists()


def test_native_setup_browser_device_access_and_revocation(source, native, distribution, tmp_path):
    root, _, ids = source
    objects, dsn, psql, binary, env, work = native
    capture(root, tmp_path / 'snapshot')
    import_snapshot(tmp_path / 'snapshot', objects, 'demo', dsn, psql, binary)
    env = {**env, 'AETHER_NATIVE_MAP_DOWNLOADS': str(distribution)}
    with running((objects, dsn, psql, binary, env, work)) as call:
        with call('map/ping') as reply:
            origin = reply.geturl().removesuffix('/api/map/ping')
            assert json.load(reply) == {'ok': True, 'app': 'map'}
        with call('map/install.sh') as reply:
            script = reply.read().decode()
            assert '@@AETHER_SERVER_URL@@' not in script
            assert 'SERVER_URL="http://127.0.0.1:' in script
            assert reply.headers['X-Content-Type-Options'] == 'nosniff'
        with pytest.raises(urllib.error.HTTPError) as denied:
            call('map/install.sh', extra={'Host': 'attacker.invalid'})
        assert denied.value.code == 403
        script_file = tmp_path / 'installer.sh'
        script_file.write_text(script)
        subprocess.run(['bash', '-n', str(script_file)], check=True, capture_output=True)
        for name in ['aether_player.py', 'aether_setup.py', 'aether_receiver.py', 'aether-projector-setup.sh']:
            with call('map/' + name) as reply:
                assert reply.read() == (distribution.parent / name).read_bytes()
        with pytest.raises(urllib.error.HTTPError) as denied:
            call('map/app.zip')
        assert denied.value.code == 401
        with call('login', {'username': 'reader', 'password': fixtures.PASSWORD}) as reply:
            cookie = reply.headers['Set-Cookie'].split(';', 1)[0]
        with call('map/app.zip', cookie=cookie) as reply:
            body = reply.read()
            assert hashlib.sha256(body).hexdigest() == json.loads(distribution.read_text())['files']['app.zip']['sha256']
            with zipfile.ZipFile(io.BytesIO(body)) as archive:
                assert 'index.html' in archive.namelist()
        with call('map/app.zip', cookie=cookie, method='HEAD') as reply:
            assert reply.read() == b'' and int(reply.headers['Content-Length']) == len(body)
        proof = {'device_id': 'pi-download', 'pairing_secret': 'private-pi-distribution-proof-2026'}
        with call('map/devices/announce', proof) as reply:
            code = json.load(reply)['code']
        with call('map/devices/claim', {'code': code}, cookie=cookie) as reply:
            assert json.load(reply)['claimed']
        with call('map/devices/announce', proof) as reply:
            bearer = json.load(reply)['token']
        # An unassigned but owned Pi must be able to fetch its offline app.
        with call('map/app.zip', bearer=bearer) as reply:
            assert hashlib.sha256(reply.read()).hexdigest() == hashlib.sha256(body).hexdigest()
        player_dir = tmp_path / 'player-cache'
        player_dir.mkdir()
        subprocess.run([sys.executable, '-c',
            "import os,sys;from pathlib import Path;sys.path.insert(0,sys.argv[1]);from aether_player import fetch_app;assert fetch_app({'server_url':os.environ['AETHER_TEST_SERVER_URL'],'token':os.environ['AETHER_TEST_DEVICE_TOKEN']},Path(sys.argv[2]))",
            str(distribution.parent), str(player_dir)],
            env={**os.environ, 'AETHER_TEST_SERVER_URL': origin, 'AETHER_TEST_DEVICE_TOKEN': bearer},
            check=True, capture_output=True, timeout=45)
        assert (player_dir / 'index.html').read_bytes() == (MAP / 'dist/index.html').read_bytes()
        with pytest.raises(urllib.error.HTTPError) as denied:
            call('map/app.zip', cookie=cookie, bearer=bearer)
        assert denied.value.code == 401
        with pytest.raises(urllib.error.HTTPError) as denied:
            call('map/app.zip', cookie=cookie, extra={'Origin': 'https://other.invalid'})
        assert denied.value.code == 403
        pg(psql, dsn, "UPDATE aether_access.applications SET enabled=false WHERE id='map'")
        for credentials in [{'cookie': cookie}, {'bearer': bearer}]:
            with pytest.raises(urllib.error.HTTPError) as denied:
                call('map/app.zip', **credentials)
            assert denied.value.code == 404
        pg(psql, dsn, "UPDATE aether_access.applications SET enabled=true WHERE id='map'")
        pg(psql, dsn, "UPDATE aether_identity.users SET active=false WHERE id='" + ids['reader'] + "'")
        for credentials in [{'cookie': cookie}, {'bearer': bearer}]:
            with pytest.raises(urllib.error.HTTPError) as denied:
                call('map/app.zip', **credentials)
            assert denied.value.code == 401


def test_unconfigured_native_setup_is_explicitly_unavailable(native):
    with running(native) as call:
        for route in ('map/ping', 'map/install.sh', 'map/aether_player.py'):
            with pytest.raises(urllib.error.HTTPError) as unavailable:
                call(route)
            assert unavailable.value.code == 503
