"""Offline Map transfer: explicit media ownership and retained device authority.

No runtime product semantics. Studio migrates attachment declarations, immutable
bytes and device credentials. Operator ownership decisions are archived with the
snapshot because the legacy upload store never recorded an owner.
"""
import hashlib
import json
import math
import os
import re
import stat
from collections import Counter

CHUNK = 1024 * 1024
MAX_MEDIA = 512 * CHUNK
EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'mp4', 'm4v', 'mov',
              'webm', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'}


def media_name(name):
    if not isinstance(name, str) or '.' not in name:
        return False
    stem, extension = name.rsplit('.', 1)
    return (0 < len(stem.encode()) <= 64 and extension.lower() in EXTENSIONS
            and all(c.isalnum() or c in '-_' for c in stem))


def read_chunks(path, require):
    """Never follow a source symlink or buffer a complete video."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode), 'Non-regular asset refused.')
        while part := stream.read(CHUNK):
            yield part
        after = os.fstat(stream.fileno())
        current = path.stat(follow_symlinks=False)
        fields = ('st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_ctime_ns')
        require(all(getattr(before, k) == getattr(after, k) == getattr(current, k)
                    for k in fields), 'Source asset changed during capture; retry.')


def file_digest(path, require):
    sha = hashlib.sha256()
    for part in read_chunks(path, require):
        sha.update(part)
    return sha.hexdigest()


def private_directory(path):
    missing, parent = [], path
    while not parent.exists():
        missing.append(parent)
        parent = parent.parent
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    for directory in missing:
        directory.chmod(0o700)


def copy_asset(source, target, require):
    private_directory(target.parent)
    sha = hashlib.sha256()
    with target.open('xb') as out:
        os.chmod(target, 0o600)
        for part in read_chunks(source, require):
            out.write(part)
            sha.update(part)
        out.flush()
        os.fsync(out.fileno())
    require(file_digest(source, require) == sha.hexdigest(),
            'Source asset changed during capture; retry.')


def media(db, assets, owners, require):
    require(isinstance(owners, dict), 'Map media ownership must be a filename-to-user-ID object.')
    users = {r[0] for r in db.execute('SELECT id FROM users')}
    base = assets / 'map-media'
    require(not base.is_symlink() and (not base.exists() or base.is_dir()), 'Invalid Map media directory.')
    paths = sorted(base.iterdir()) if base.exists() else []
    require(all(media_name(p.name) and p.is_file() and not p.is_symlink() for p in paths),
            'Unsupported Map media entry; preserve and resolve it before capture.')
    require(set(owners) == {p.name for p in paths},
            'Map media ownership must explicitly cover every stored file, including unreferenced files.')
    require(all(isinstance(v, str) and v in users for v in owners.values()), 'Invalid Map media owner.')
    require(all(n <= 4096 for n in Counter(owners.values()).values()), 'Map media owner exceeds native file limit.')
    manifests = []
    for path in paths:
        require(1 <= path.stat().st_size <= MAX_MEDIA, 'Map media size is outside native limits.')
        sha, parts, size = hashlib.sha256(), [], 0
        for part in read_chunks(path, require):
            size += len(part)
            require(size <= MAX_MEDIA, 'Map media size is outside native limits.')
            sha.update(part)
            parts.append({'digest': hashlib.sha256(part).hexdigest(), 'size': len(part)})
        require(size > 0, 'Empty Map media refused.')
        manifests.append({'name': path.name, 'owner': owners[path.name], 'size': size,
                          'digest': sha.hexdigest(), 'chunks': parts, 'deleted': False})
    refs = set()
    for row in db.execute("SELECT h.file_id,b.content FROM library_history h JOIN library f ON f.id=h.file_id JOIN library_blobs b ON b.hash=h.blob_hash WHERE f.app='map' AND f.kind='file'"):
        try:
            document = json.loads(bytes(row['content']))
        except (ValueError, UnicodeError):
            continue  # Matches native opaque-document handling.
        if not isinstance(document, dict) or 'media' not in document:
            continue
        require(isinstance(document['media'], list), 'Invalid Map revision media declaration.')
        require(len(document['media']) <= 4096, 'Map revision exceeds native media limit.')
        for item in document['media']:
            name = item.get('file') if isinstance(item, dict) else None
            require(media_name(name), 'Invalid Map revision media filename.')
            require(name in owners, 'Map revision references media missing from the qualified asset import.')
            refs.add((row['file_id'], name))
    require(all(n <= 4096 for n in Counter(name for _, name in refs).values()),
            'Map media references exceed native authorization limit.')
    return {'media': manifests, 'refs': [{'document': doc, 'name': name} for doc, name in sorted(refs)]}


def devices(db, require):
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if 'map_devices' not in tables:
        return []
    rows = [dict(r) for r in db.execute('SELECT * FROM map_devices ORDER BY id')]
    require(len(rows) <= 64, 'Too many legacy Map devices.')
    users = {r[0] for r in db.execute('SELECT id FROM users')}
    documents = {r[0] for r in db.execute("SELECT id FROM library WHERE app='map' AND kind='file'")}
    result, codes, tokens = [], set(), set()
    for row in rows:
        require(set(row) == {'id', 'name', 'owner', 'code', 'code_expires', 'seen', 'token',
                             'pairing_secret_hash', 'document', 'deployed'}, 'Unsupported Map device fields.')
        require(isinstance(row['id'], str) and re.fullmatch(r'[A-Za-z0-9_-]{1,64}', row['id']), 'Invalid Map device ID.')
        name = row['name']
        require(isinstance(name, str) and 1 <= len(name) <= 80 and name == name.strip()
                and not any(ord(c) < 32 or 127 <= ord(c) <= 159 for c in name), 'Invalid Map device name.')
        proof = row['pairing_secret_hash']
        require(isinstance(proof, str) and re.fullmatch(r'[a-f0-9]{64}', proof),
                'Map device lacks a qualified private pairing proof; re-enroll with the original host first.')
        for key in ('code_expires', 'seen', 'deployed'):
            value = row[key]
            require(type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 253402300799,
                    'Invalid Map device timestamp.')
        owner, token, code, doc = row['owner'], row['token'], row['code'], row['document']
        if owner is None:
            require(token == '' and doc is None and isinstance(code, str)
                    and re.fullmatch(r'[0-9]{6}', code) and code not in codes,
                    'Invalid unclaimed Map device authority.')
            codes.add(code)
            token_hash = None
        else:
            require(owner in users and code == '' and isinstance(token, str)
                    and re.fullmatch(r'aether_dev_[A-Za-z0-9_-]{32}', token)
                    and token not in tokens and (doc is None or doc in documents),
                    'Invalid claimed Map device authority.')
            tokens.add(token)
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            code = None
        result.append({'id': row['id'], 'name': name, 'owner': owner, 'pairing_hash': proof,
                       'token_hash': token_hash, 'code': code, 'code_expires': row['code_expires'],
                       'seen': row['seen'], 'document': doc, 'deployed': row['deployed'] or None})
    return result


def write_chunks(snapshot, objects, tenant, manifests, require):
    root = objects / 'uploads-v1' / hashlib.sha256(tenant.encode()).hexdigest()
    private_directory(root)
    for entry in manifests:
        parts, sha = [], hashlib.sha256()
        for part in read_chunks(snapshot / 'assets/map-media' / entry['name'], require):
            key = hashlib.sha256(part).hexdigest()
            parts.append({'digest': key, 'size': len(part)})
            sha.update(part)
            target = root / key
            if not target.exists():
                with target.open('xb') as out:
                    os.chmod(target, 0o600)
                    out.write(part)
                    out.flush()
                    os.fsync(out.fileno())
            require(file_digest(target, require) == key, 'Imported Map chunk differs.')
        require(parts == entry['chunks'] and sha.hexdigest() == entry['digest'], 'Map media changed after snapshot verification.')
