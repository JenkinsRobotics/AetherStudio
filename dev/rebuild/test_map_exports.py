"""Real Map worker + Rust project downloads + retained media authority."""
import base64
import concurrent.futures
import hashlib
import io
import json
import shutil
import time
import urllib.error
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import pytest

from dev.rebuild import test_legacy_map as map_fixtures
from dev.rebuild import test_legacy_transfer as fixtures
from dev.rebuild.legacy_transfer import capture, import_snapshot, pg
from dev.rebuild.test_legacy_map import running

mapped = map_fixtures.mapped
native = fixtures.native
source = fixtures.source
ROOT = fixtures.ROOT
MAP = (ROOT / json.loads((ROOT / 'projects.json').read_text())['projects']['map']).resolve()


@pytest.fixture
def exported(mapped, native, tmp_path):
    root, host, ids, ownership, files, bearer, _ = mapped
    show = {'output': {'width': 1920, 'height': 1080}, 'scenes': [
        {'name': 'Scene " onload="bad', 'artboard': {'widthPx': 2400, 'heightPx': 1200},
         'surfaces': [{'name': '<script>alert(1)</script>', 'corners': [[0, 0], [100, 0], [100, 90], [0, 90]],
                       'mask': [[0, 0], [1, 0], [0, 1]]}]}],
        'media': [{'file': 'current.mp4'}, {'file': 'current.mp4'}]}
    # Exact whitespace and duplicate references must survive in the saved bytes.
    content = json.dumps(show, indent=3).encode() + b'\n'
    token = host.store.sign_in('owner', fixtures.PASSWORD, 'local')
    result = host.dispatch('/api/library/read', {'app': 'map', 'id': ids['file']}, token, 'local')
    host.dispatch('/api/library/save', {'app': 'map', 'id': ids['file'], 'expected_revision': result['revision'],
                  'data_base64': base64.b64encode(content).decode()}, token, 'local')
    objects, dsn, psql, binary, env, work = native
    capture(root, tmp_path / 'snapshot', ownership)
    import_snapshot(tmp_path / 'snapshot', objects, 'demo', dsn, psql, binary)
    config = tmp_path / 'products.json'
    config.write_text(json.dumps({'schema': 1, 'node': shutil.which('node'), 'manifests': [
        str(MAP / 'service/aether_map_service/runtime/native-worker.json')]}))
    env = {**env, 'AETHER_NATIVE_PRODUCTS': str(config)}
    return (objects, dsn, psql, binary, env, work), ids, content, files, bearer


def login(call, name):
    with call('login', {'username': name, 'password': fixtures.PASSWORD}) as reply:
        return reply.headers['Set-Cookie'].split(';', 1)[0]


def denied(call, path, status, **kwargs):
    with pytest.raises(urllib.error.HTTPError) as error:
        call(path, **kwargs)
    assert error.value.code == status


def test_exact_bundle_wireframe_and_current_authority(exported):
    native, ids, content, files, bearer = exported
    _, dsn, psql, *_ = native
    before = pg(psql, dsn, 'SELECT count(*) FROM aether_store.revisions')
    with running(native) as call:
        owner, reader = login(call, 'owner'), login(call, 'reader')
        path = f'map/project/{ids["file"]}'
        denied(call, path + '.zip', 401)
        denied(call, path + '.zip', 401, bearer=bearer)
        denied(call, path + '.zip', 403, cookie=owner, extra={'Origin': 'https://foreign.invalid'})
        denied(call, f'map/project/{ids["private"]}.svg', 404, cookie=owner)
        denied(call, path + '.exe', 400, cookie=owner)
        with call(path + '.zip', cookie=reader) as reply:
            data = reply.read()
            assert int(reply.headers['Content-Length']) == len(data)
            assert reply.headers['Content-Type'] == 'application/zip'
            assert reply.headers['Cache-Control'] == 'no-store'
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            assert archive.testzip() is None
            assert set(archive.namelist()) == {'First/' + n for n in [
                'show.aethermap', 'layout.json', 'wireframe.svg', 'README.txt', 'media/current.mp4']}
            assert archive.read('First/show.aethermap') == content
            assert archive.read('First/layout.json') == content
            assert archive.read('First/media/current.mp4') == files['current.mp4']
            svg = archive.read('First/wireframe.svg')
            element = ET.fromstring(svg)
            assert element.attrib['viewBox'] == '0 0 2400 1200'
            assert len(element.findall('.//{http://www.w3.org/2000/svg}polygon')) == 2
            assert b'<script>' not in svg
        with call(path + '.svg', cookie=reader) as reply:
            assert reply.read() == svg
            assert 'sandbox' in reply.headers['Content-Security-Policy']
        with call(path + '.zip', cookie=owner, method='HEAD') as reply:
            assert reply.read() == b''
            assert int(reply.headers['Content-Length']) == len(data)
        assert pg(psql, dsn, 'SELECT count(*) FROM aether_store.revisions') == before
        pg(psql, dsn, 'DELETE FROM aether_access.grants')
        denied(call, path + '.zip', 404, cookie=reader)
        with call(path + '.zip', cookie=owner) as reply:
            assert reply.read() == data
        pg(psql, dsn, "UPDATE aether_access.applications SET enabled=false WHERE id='map'")
        denied(call, path + '.zip', 404, cookie=owner)
        pg(psql, dsn, "UPDATE aether_access.applications SET enabled=true WHERE id='map'")
        pg(psql, dsn, "UPDATE aether_identity.users SET active=false WHERE username='owner'")
        denied(call, path + '.svg', 401, cookie=owner)


def test_corrupt_media_never_returns_a_partial_successful_archive(exported):
    native, ids, _, files, _ = exported
    objects = native[0]
    digest = hashlib.sha256(files['current.mp4'][:1024 * 1024]).hexdigest()
    paths = list(objects.rglob(digest))
    assert len(paths) == 1
    paths[0].write_bytes(b'corruption')
    with running(native) as call:
        owner = login(call, 'owner')
        denied(call, f'map/project/{ids["file"]}.zip', 503, cookie=owner)
        # Geometry-only export does not need media bytes.
        with call(f'map/project/{ids["file"]}.svg', cookie=owner) as reply:
            ET.fromstring(reply.read())


def test_export_requires_an_explicitly_installed_map_worker(exported):
    native, ids, *_ = exported
    objects, dsn, psql, binary, env, work = native
    env.pop('AETHER_NATIVE_PRODUCTS')
    with running((objects, dsn, psql, binary, env, work)) as call:
        owner = login(call, 'owner')
        denied(call, f'map/project/{ids["file"]}.svg', 503, cookie=owner)


@pytest.mark.parametrize('change', ['revoke', 'save'])
def test_authority_and_revision_rechecked_after_product_worker(exported, tmp_path, change):
    native, ids, content, _, _ = exported
    _, dsn, psql, _, env, _ = native
    runtime = MAP / 'service/aether_map_service/runtime'
    marker = tmp_path / 'worker-started'
    worker = ("import { writeFileSync as exportSignal } from 'node:fs';\n"
              f"exportSignal({json.dumps(str(marker))}, 'started');\n"
              "await new Promise(resolve => setTimeout(resolve, 1500));\n" +
              (runtime / 'runner.mjs').read_text())
    (tmp_path / 'runner.mjs').write_text(worker)
    manifest = json.loads((runtime / 'native-worker.json').read_text())
    manifest.update(entry='runner.mjs', sha256=hashlib.sha256(worker.encode()).hexdigest())
    (tmp_path / 'worker.json').write_text(json.dumps(manifest))
    config = Path(env['AETHER_NATIVE_PRODUCTS'])
    config.write_text(json.dumps({'schema': 1, 'node': shutil.which('node'),
                                 'manifests': [str(tmp_path / 'worker.json')]}))
    with running(native) as call:
        owner, reader = login(call, 'owner'), login(call, 'reader')
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(call, f'map/project/{ids["file"]}.zip', cookie=reader)
            deadline = time.monotonic() + 5
            while not marker.exists() and time.monotonic() < deadline:
                time.sleep(0.02)
            assert marker.exists()
            if change == 'revoke':
                pg(psql, dsn, 'DELETE FROM aether_access.grants')
            else:
                with call('library/read', {'app': 'map', 'id': ids['file']}, cookie=owner) as reply:
                    revision = json.load(reply)['revision']
                with call('library/save', {'app': 'map', 'id': ids['file'], 'expected_revision': revision,
                          'operation_id': 'export-race-save',
                          'data_base64': base64.b64encode(content + b'\n').decode()}, cookie=owner) as reply:
                    json.load(reply)
            with pytest.raises(urllib.error.HTTPError) as error:
                future.result(timeout=10)
            assert error.value.code == (404 if change == 'revoke' else 409)


def repeated_media(native, name, count):
    _, dsn, psql, *_ = native
    block = b'x' * (1024 * 1024)
    full_hash = hashlib.sha256()
    for _ in range(count):
        full_hash.update(block)
    chunks = json.dumps([{'digest': hashlib.sha256(block).hexdigest(), 'size': len(block)}] * count)
    # A valid immutable manifest using the already stored shared chunk, with an
    # independently computed full-file digest; no giant fixture buffer required.
    pg(psql, dsn, f"UPDATE aether_access.map_media SET size={len(block) * count},"
                  f"digest='{full_hash.hexdigest()}',chunks='{chunks}'::jsonb WHERE name='{name}'")
    return full_hash.hexdigest()


def test_large_archive_streams_complete_media(exported, tmp_path):
    native, ids, content, *_ = exported
    expected = repeated_media(native, 'current.mp4', 128)
    target = tmp_path / 'show.zip'
    with running(native) as call:
        cookie = login(call, 'owner')
        with call(f'map/project/{ids["file"]}.zip', cookie=cookie) as reply, target.open('wb') as out:
            shutil.copyfileobj(reply, out, length=64 * 1024)
            length = int(reply.headers['Content-Length'])
    assert target.stat().st_size == length > 128 * 1024 * 1024
    with zipfile.ZipFile(target) as archive:
        assert archive.read('First/layout.json') == content
        with archive.open('First/media/current.mp4') as file:
            assert hashlib.file_digest(file, 'sha256').hexdigest() == expected


def test_total_payload_limit_before_media_io(exported):
    native, ids, content, *_ = exported
    for name in ['current.mp4', 'history.png']:
        repeated_media(native, name, 512)
    with running(native) as call:
        cookie = login(call, 'owner')
        with call('library/read', {'app': 'map', 'id': ids['file']}, cookie=cookie) as reply:
            revision = json.load(reply)['revision']
        document = json.loads(content)
        document['media'].append({'file': 'history.png'})
        with call('library/save', {'app': 'map', 'id': ids['file'], 'expected_revision': revision,
                  'operation_id': 'export-size-limit',
                  'data_base64': base64.b64encode(json.dumps(document).encode()).decode()}, cookie=cookie) as reply:
            json.load(reply)
        denied(call, f'map/project/{ids["file"]}.zip', 413, cookie=cookie)
