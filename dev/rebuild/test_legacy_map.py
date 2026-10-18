"""Legacy Map bytes/history/device authority through the actual Rust host."""
import base64
import contextlib
import json
import shutil
import socket
import subprocess
import time
import tracemalloc
import urllib.error
import urllib.request

import pytest
from aether_map_service.devices import DeviceStore

from dev.rebuild import test_legacy_transfer as fixtures
from dev.rebuild.legacy_map import CHUNK
from dev.rebuild.legacy_transfer import (
    TransferError,
    capture,
    digest,
    import_snapshot,
    load,
    pg,
    sql_import,
)
from dev.rebuild.native_backup import IDENTITY_CREDENTIAL_EXCLUSIONS

PASSWORD = fixtures.PASSWORD
native = fixtures.native
source = fixtures.source


@pytest.fixture
def mapped(source, tmp_path):
    root, host, ids = source
    token = host.store.sign_in('owner', PASSWORD, 'local')

    def call(action, **data):
        return host.dispatch('/api/library/' + action, {'app': 'map', 'id': ids['file'], **data}, token, 'local')

    def save(expected, names, branch='Main'):
        return call('save', expected_revision=expected, branch=branch,
                    data_base64=base64.b64encode(json.dumps({'media': [{'file': n} for n in names]}).encode()).decode())

    save(2, ['history.png'])
    save(3, ['current.mp4'])
    call('branch_create', name='Media branch', from_revision=4, expected_revision=4)
    save(4, ['branch.png'], 'Media branch')
    call('branch_delete', name='Media branch', branch='Media branch', expected_revision=5, force=True)
    media = root / 'map-media'
    media.mkdir()
    files = {'history.png': b'old image', 'current.mp4': b'x' * CHUNK + b'last chunk',
             'branch.png': b'branch image', 'unused.png': b'unreferenced image'}
    for name, content in files.items():
        (media / name).write_bytes(content)
    # Explicitly let the reader own media referenced by the owner's document.
    # Document references must preserve access independently of asset ownership.
    ownership = tmp_path / 'owners.json'
    ownership.write_text(json.dumps({name: ids['reader'] for name in files}))
    devices = DeviceStore(host.store)
    proof = 'fixture-private-pairing-proof-2026'
    announced = devices.announce_device({'device_id': 'pi-one', 'name': 'Stage Pi', 'pairing_secret': proof})
    devices.claim_device(ids['reader'], announced['code'])
    bearer = devices.announce_device({'device_id': 'pi-one', 'pairing_secret': proof})['token']
    host.store.db.execute('UPDATE map_devices SET document=?,deployed=? WHERE id=?', (ids['file'], 1234.123456789, 'pi-one'))
    devices.announce_device({'device_id': 'pi-unclaimed', 'name': 'Spare Pi', 'pairing_secret': 'unused-private-pairing-proof-2026'})
    host.store.db.commit()
    return root, host, ids, ownership, files, bearer, proof


def test_capture_retains_media_all_history_and_devices_without_mutating_original(mapped, tmp_path):
    root, host, ids, ownership, files, bearer, _ = mapped
    before = list(host.store.db.iterdump())
    snapshot = tmp_path / 'captured'
    capture(root, snapshot, ownership)
    data, _, manifest = load(snapshot)
    assert list(host.store.db.iterdump()) == before
    assert data['_map_media']['refs'] == [{'document': ids['file'], 'name': n} for n in ['branch.png', 'current.mp4', 'history.png']]
    assert len(data['_map_media']['media']) == 4
    assert data['_map_devices'][0]['token_hash'] == digest(bearer.encode())
    assert bearer not in repr(data)
    for name, content in files.items():
        assert (snapshot / 'assets/map-media' / name).read_bytes() == content
    assert manifest['native_map_media'] and manifest['native_map_devices']
    assert all(not p.stat().st_mode & 0o077 for p in [snapshot, *snapshot.rglob('*')])
    (snapshot / 'assets/map-media/current.mp4').write_bytes(b'corrupt')
    with pytest.raises(TransferError, match='hash mismatch'):
        load(snapshot)


@pytest.mark.parametrize('damage', ['missing-owner', 'extra-owner', 'unknown-owner', 'duplicate-owner',
                                     'missing-history', 'missing-branch', 'symlink', 'nested', 'empty', 'unsafe-name', 'partial-upload'])
def test_capture_refuses_ambiguous_or_incomplete_media(mapped, tmp_path, damage):
    root, _, _, ownership, _, _, _ = mapped
    owners = json.loads(ownership.read_text())
    if damage == 'missing-owner':
        owners.pop('unused.png')
    elif damage == 'extra-owner':
        owners['absent.png'] = next(iter(owners.values()))
    elif damage == 'unknown-owner':
        owners['unused.png'] = 'unknown'
    elif damage == 'duplicate-owner':
        ownership.write_text('{"unused.png":"one","unused.png":"two"}')
    elif damage in ('missing-history', 'missing-branch'):
        name = 'history.png' if damage == 'missing-history' else 'branch.png'
        (root / 'map-media' / name).unlink()
        owners.pop(name)
    elif damage == 'symlink':
        (root / 'map-media/unused.png').unlink()
        (root / 'map-media/unused.png').symlink_to(root / 'studio.sqlite3')
    elif damage == 'nested':
        (root / 'map-media/folder').mkdir()
    elif damage == 'empty':
        (root / 'map-media/unused.png').write_bytes(b'')
    else:
        (root / 'map-media' / ('unsafe.svg' if damage == 'unsafe-name' else 'upload.mp4.part')).write_bytes(b'pending')
    if damage != 'duplicate-owner':
        ownership.write_text(json.dumps(owners))
    with pytest.raises((TransferError, OSError)):
        capture(root, tmp_path / 'refused', ownership)
    assert not (tmp_path / 'refused').exists()


@pytest.mark.parametrize('field,value', [('pairing_secret_hash', ''), ('pairing_secret_hash', 'z'*64),
    ('token', 'weak'), ('owner', 'unknown'), ('document', 'unknown'), ('name', 'bad\nname'),
    ('seen', -1), ('code', '123456'), ('id', '../bad')])
def test_capture_refuses_invalid_device_authority(mapped, tmp_path, field, value):
    root, host, _, ownership, _, _, _ = mapped
    host.store.db.execute('PRAGMA foreign_keys=OFF')
    host.store.db.execute(f'UPDATE map_devices SET {field}=? WHERE id=?', (value, 'pi-one'))
    host.store.db.commit()
    with pytest.raises(TransferError):
        capture(root, tmp_path / 'refused', ownership)
    assert not (tmp_path / 'refused').exists()


@contextlib.contextmanager
def running(native):
    _, _, _, binary, env, _ = native
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    server = subprocess.Popen([str(binary), 'serve'], env={**env, 'AETHER_NATIVE_LISTEN': f'127.0.0.1:{port}'},
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(origin + '/api/status', timeout=1).close()
                break
            except (OSError, urllib.error.URLError):
                time.sleep(0.05)

        def call(path, payload=None, cookie='', bearer='', method=None, extra=None):
            headers = {'Origin': origin, **(extra or {})}
            if cookie:
                headers['Cookie'] = cookie
            if bearer:
                headers['Authorization'] = 'Bearer ' + bearer
            body = None
            if payload is not None:
                body = json.dumps(payload).encode()
                headers['Content-Type'] = 'application/json'
            return urllib.request.urlopen(urllib.request.Request(origin + '/api/' + path,
                   data=body, headers=headers, method=method), timeout=10)
        yield call
    finally:
        server.terminate()
        server.wait(timeout=10)


def test_native_import_media_history_range_device_and_revocation(mapped, tmp_path, native):
    root, _, ids, ownership, files, bearer, proof = mapped
    objects, dsn, psql, binary, env, _ = native
    snapshot = tmp_path / 'snapshot'
    capture(root, snapshot, ownership)
    report = import_snapshot(snapshot, objects, 'demo', dsn, psql, binary)
    assert (report['map_media'], report['map_media_refs'], report['map_devices']) == (4, 3, 2)
    assert pg(psql, dsn, 'SELECT count(*) FROM aether_store.revisions') == '7'
    assert pg(psql, dsn, 'SELECT token_hash FROM aether_access.map_devices WHERE id=\'pi-one\'') == digest(bearer.encode())
    # SQL failure after media/device insertion rolls back all authority and history.
    data, blobs, _ = load(snapshot)
    for history in data['library_history']:
        history['size_bytes'] = len(blobs[history['blob_hash']])
    sql, _ = sql_import(data, 'demo')
    pg(psql, dsn, 'CREATE DATABASE rejected')
    rejected = dsn.replace('dbname=postgres', 'dbname=rejected')
    subprocess.run([str(binary), 'migrate'], env={**env, 'AETHER_NATIVE_PG': rejected}, check=True, capture_output=True)
    with pytest.raises(TransferError):
        pg(psql, rejected, sql.replace('COMMIT;', 'SELECT 1/0; COMMIT;'))
    for table in ('aether_access.map_devices', 'aether_access.map_media', 'aether_access.map_media_refs', 'aether_identity.users'):
        assert pg(psql, rejected, 'SELECT count(*) FROM ' + table) == '0'
    # A private recovery dump retains machine hashes and history. Interactive
    # sessions/agent grants remain excluded by the shared recovery policy.
    dump = tmp_path / 'native.sql'
    with dump.open('wb') as out:
        subprocess.run([str(psql.parent / 'pg_dump'), '--dbname', dsn, '--no-owner', '--no-privileges',
                        *IDENTITY_CREDENTIAL_EXCLUSIONS], stdout=out, stderr=subprocess.PIPE, check=True)
    pg(psql, dsn, 'CREATE DATABASE restored')
    restored = dsn.replace('dbname=postgres', 'dbname=restored')
    pg(psql, restored, dump.read_text())
    restored_objects = tmp_path / 'restored-objects'
    shutil.copytree(objects, restored_objects)
    dsn, objects = restored, restored_objects
    env = {**env, 'AETHER_NATIVE_PG': restored, 'AETHER_NATIVE_OBJECTS': str(restored_objects)}
    native = (objects, dsn, psql, binary, env, native[-1])
    # Objects do not depend on the archive after import.
    (snapshot / 'assets/map-media').rename(snapshot / 'archived-media')
    with running(native) as call:
        def login(name):
            with call('login', {'username': name, 'password': PASSWORD}) as reply:
                return reply.headers['Set-Cookie'].split(';', 1)[0]
        reader, owner = login('reader'), login('owner')
        for name in ('current.mp4', 'history.png', 'branch.png'):
            with call('map/media/' + name, cookie=owner) as reply:
                assert reply.read() == files[name]
        with pytest.raises(urllib.error.HTTPError) as denied:
            call('map/media/unused.png', cookie=owner)
        assert denied.value.code == 404
        with call('map/media/unused.png', cookie=reader) as reply:
            assert reply.read() == files['unused.png']
        with call('map/media/current.mp4', cookie=owner, extra={'Range': f'bytes={CHUNK-3}-{CHUNK+3}'}) as reply:
            assert reply.status == 206 and reply.read() == files['current.mp4'][CHUNK-3:CHUNK+4]
        with call('map/device/show', bearer=bearer) as reply:
            assert json.load(reply)['show']['id'] == ids['file']
        with call('map/media/current.mp4', bearer=bearer) as reply:
            assert reply.read() == files['current.mp4']
        for name in ('history.png', 'branch.png', 'unused.png'):
            with pytest.raises(urllib.error.HTTPError) as denied:
                call('map/media/' + name, bearer=bearer)
            assert denied.value.code == 404
        with pytest.raises(urllib.error.HTTPError) as retained:
            call('map/media/branch.png', cookie=reader, method='DELETE')
        assert retained.value.code == 409
        with call('map/media/unused.png', cookie=reader, method='DELETE') as reply:
            assert reply.status == 200
        # The imported proof recovers/rotates the old bearer, without a new claim.
        with call('map/devices/announce', {'device_id': 'pi-one', 'pairing_secret': proof}) as reply:
            new_token = json.load(reply)['token']
        assert new_token != bearer
        with pytest.raises(urllib.error.HTTPError) as denied:
            call('map/device/show', bearer=bearer)
        assert denied.value.code == 401
        with call('map/device/show', bearer=new_token) as reply:
            assert json.load(reply)['show']['id'] == ids['file']
        pg(psql, dsn, 'DELETE FROM aether_access.grants')
        with call('map/device/show', bearer=new_token) as reply:
            assert json.load(reply)['show'] is None
        with pytest.raises(urllib.error.HTTPError) as denied:
            call('map/media/current.mp4', bearer=new_token)
        assert denied.value.code == 404
        # The reader still owns its media; device authority is narrower.
        with call('map/media/current.mp4', cookie=reader) as reply:
            assert reply.read() == files['current.mp4']
    checked = subprocess.run([str(binary), 'verify-store'], env=env, capture_output=True, check=False)
    assert checked.returncode == 0
    chunk = next((objects / 'uploads-v1').rglob(digest(b'x' * CHUNK)))
    chunk.write_bytes(b'corrupt')
    checked = subprocess.run([str(binary), 'verify-store'], env=env, capture_output=True, check=False)
    assert checked.returncode != 0


def test_maximum_media_transfer_streams_with_bounded_python_memory(source, tmp_path, native):
    root, _, ids = source
    media = root / 'map-media'
    media.mkdir()
    with (media / 'large.mp4').open('wb') as out:
        out.truncate(512 * CHUNK)
    ownership = tmp_path / 'owners.json'
    ownership.write_text(json.dumps({'large.mp4': ids['owner']}))
    objects, dsn, psql, binary, _, _ = native
    tracemalloc.start()
    try:
        capture(root, tmp_path / 'snapshot', ownership)
        report = import_snapshot(tmp_path / 'snapshot', objects, 'demo', dsn, psql, binary)
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
    assert report['map_media'] == 1 and peak < 32 * CHUNK
    print(f'512 MiB import: Python peak {peak} bytes')
    assert pg(psql, dsn, 'SELECT size FROM aether_access.map_media') == str(512 * CHUNK)
    # Content-addressed chunks deduplicate repeated bytes without losing length.
    assert pg(psql, dsn, 'SELECT jsonb_array_length(chunks) FROM aether_access.map_media') == '512'


def test_capture_refuses_oversized_media_before_copy(source, tmp_path):
    root, _, _ = source
    media = root / 'map-media'
    media.mkdir()
    with (media / 'large.mp4').open('wb') as out:
        out.truncate(512 * CHUNK + 1)
    with pytest.raises(TransferError, match='size'):
        capture(root, tmp_path / 'snapshot')
    assert not (tmp_path / 'snapshot').exists()


def test_stream_detects_mutation_and_path_replacement(tmp_path):
    from dev.rebuild.legacy_map import read_chunks
    from dev.rebuild.legacy_transfer import require
    path = tmp_path / 'asset.mp4'
    path.write_bytes(b'x' * (CHUNK + 10))
    stream = read_chunks(path, require)
    assert len(next(stream)) == CHUNK
    path.rename(tmp_path / 'moved.mp4')
    path.write_bytes(b'x' * (CHUNK + 10))
    with pytest.raises(TransferError, match='changed'):
        list(stream)


def test_operator_target_preparation_keeps_native_target_stopped(mapped, tmp_path):
    import sys

    root, _, _, ownership, files, _, _ = mapped
    snapshot, target = tmp_path / 'snapshot', tmp_path / 'target'
    capture(root, snapshot, ownership)
    result = subprocess.run([sys.executable, str(fixtures.ROOT / 'dev/rebuild/prepare_demo_target.py'),
                             '--snapshot', str(snapshot), '--target', str(target)],
                            capture_output=True, check=False, timeout=120)
    assert result.returncode == 0, result.stderr.decode()
    report = json.loads(result.stdout)
    assert report['map_media'] == 4 and report['map_devices'] == 2
    assert report['dump_restore'] == 'passed' and report['target_running'] is False
    assert report['original_server_unchanged'] is True and report['cutover'] is False
    assert not (target / 'postgres/postmaster.pid').exists()
    inventory = json.loads((target / 'recovery-manifest.json').read_text())
    for name, content in files.items():
        assert inventory['legacy-assets/map-media/' + name] == digest(content)
    assert all(not p.stat().st_mode & 0o077 for p in [target, *target.rglob('*')])
