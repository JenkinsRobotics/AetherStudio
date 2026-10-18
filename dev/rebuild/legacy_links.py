"""Read-only link credential/visit preservation; never mint replacement secrets."""
import math
import re


def extract(db, require):
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if 'drive_links' not in tables:
        require('drive_link_visits' not in tables or not db.execute('SELECT 1 FROM drive_link_visits LIMIT 1').fetchone(), 'Link visits without links.')
        return {'links': [], 'visits': []}
    columns = {r[1] for r in db.execute('PRAGMA table_info(drive_links)')}
    core = {'id', 'file_id', 'token_hash', 'audience', 'role', 'expires', 'created', 'revoked'}
    require(core <= columns <= core | {'shared_by'}, 'Unsupported link fields.')
    users = {r[0] for r in db.execute('SELECT id FROM users')}
    files = {r[0] for r in db.execute('SELECT id FROM library')}
    links, visits, ids, hashes = [], [], set(), set()
    for raw in db.execute('SELECT * FROM drive_links'):
        row = dict(raw)
        require(isinstance(row['id'], str) and re.fullmatch(r'[A-Za-z0-9_.:-]{1,128}', row['id']), 'Invalid link identity.')
        require(row['file_id'] in files and row['id'] not in ids, 'Invalid link resource or duplicate identity.')
        require(row['audience'] == 'organization' and row['role'] in ('viewer', 'editor'), 'Unsupported link audience or role.')
        require(isinstance(row['token_hash'], str) and re.fullmatch(r'[a-f0-9]{64}', row['token_hash']) and row['token_hash'] not in hashes, 'Invalid or duplicate link digest.')
        require(row['revoked'] in (0, 1), 'Invalid link revocation.')
        for key in ('created', 'expires'):
            require(type(row[key]) in (int, float) and math.isfinite(row[key]) and 0 <= row[key] < 253402300799, 'Invalid link timestamp.')
        require(row.get('shared_by') is None or row['shared_by'] in users, 'Missing link author.')
        ids.add(row['id']); hashes.add(row['token_hash'])
        links.append({**row, 'shared_by': row.get('shared_by')})
    if 'drive_link_visits' in tables:
        require({r[1] for r in db.execute('PRAGMA table_info(drive_link_visits)')} == {'link_id', 'user_id'}, 'Unsupported link visit fields.')
        seen = set()
        for link, user in db.execute('SELECT link_id,user_id FROM drive_link_visits'):
            require(link in ids and user in users and (link, user) not in seen, 'Invalid link visit.')
            seen.add((link, user)); visits.append({'link': link, 'user_id': user})
    return {'links': sorted(links, key=lambda r: r['id']), 'visits': sorted(visits, key=lambda r: (r['link'], r['user_id']))}
