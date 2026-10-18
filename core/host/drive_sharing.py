"""Active sharing provenance for Drive's With you / By you projections."""

import time


def migrate_sharing(db):
    # Existing shares remain valid. Their unknown grantor/date are not inferred.
    for table, columns in {
        "drive_grants": {"shared_by": "TEXT", "shared_at": "REAL"},
        "drive_links": {"shared_by": "TEXT"},
    }.items():
        existing = {r[1] for r in db.execute(f"PRAGMA table_info({table})")}
        for column, kind in columns.items():
            if column not in existing:
                db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {kind}")


def shared_metadata(drive, row, uid, direction):
    """Called only after the ordinary file ACL check. Never expose recipients."""
    db, access = drive.db, drive.access
    org = access.location(row)["organization"]
    candidates, authored, cursor, seen = [], False, row, set()
    while cursor and cursor["id"] not in seen:
        seen.add(cursor["id"])
        grants = db.execute(
            """SELECT g.user_id,g.shared_by,g.shared_at FROM drive_grants g
            JOIN users u ON u.id=g.user_id AND u.active=1
            JOIN drive_members m ON m.user_id=g.user_id AND m.organization=?
            WHERE g.file_id=? AND g.user_id!=?""",
            (org, cursor["id"], cursor["owner"]),
        )
        for grant in grants:
            by_me = grant["shared_by"] == uid or (
                grant["shared_by"] is None and cursor["owner"] == uid
            )
            authored |= by_me
            if (direction == "by" and by_me) or (
                direction == "with" and grant["user_id"] == uid
            ):
                candidates.append((grant["shared_at"], grant["shared_by"]))
        links = db.execute(
            """SELECT l.shared_by,l.created,EXISTS(
            SELECT 1 FROM drive_link_visits v WHERE v.link_id=l.id AND v.user_id=?) visited
            FROM drive_links l WHERE l.file_id=? AND l.revoked=0 AND l.expires>?""",
            (uid, cursor["id"], time.time()),
        )
        for link in links:
            by_me = link["shared_by"] == uid or (
                link["shared_by"] is None and cursor["owner"] == uid
            )
            authored |= by_me
            if (direction == "by" and by_me) or (
                direction == "with" and link["visited"]
            ):
                candidates.append((link["created"], link["shared_by"]))
        cursor = (
            db.execute(
                "SELECT * FROM library WHERE id=?", (cursor["parent"],)
            ).fetchone()
            if cursor["parent"]
            else None
        )
    # Workspace membership also confers sharing. Older workspace placement has
    # no durable grantor/date, so these cells correctly remain unknown.
    authored |= row["owner"] == uid and bool(access.location(row)["workspace"])
    included = authored if direction == "by" else row["owner"] != uid
    shared_at, shared_by = (
        max(candidates, key=lambda c: c[0] or 0) if candidates else (None, None)
    )
    person = (
        db.execute(
            "SELECT COALESCE(NULLIF(full_name,''),username) FROM users WHERE id=?",
            (shared_by,),
        ).fetchone()
        if shared_by
        else None
    )
    return included, {
        "shared_at": shared_at,
        "shared_by": person[0] if person else None,
    }
