"""Read-only projections for Drive's file table; no parallel metadata store."""

import time


def listing_metadata(drive, row, uid):
    db, access = drive.db, drive.access
    latest = db.execute(
        """SELECT action,created,COALESCE(NULLIF(u.full_name,''),u.username) author
        FROM drive_events e JOIN users u ON u.id=e.actor
        WHERE file_id=? ORDER BY e.id DESC LIMIT 1""",
        (row["id"],),
    ).fetchone()
    # Sharing/favoriting/opening must never replace the actual content editor.
    modifier = db.execute(
        """SELECT author FROM (
          SELECT COALESCE(NULLIF(u.full_name,''),u.username) author,h.saved changed
          FROM library_history h JOIN users u ON u.id=h.author
          WHERE h.file_id=? AND h.revision=? AND h.event!='baseline'
          UNION ALL
          SELECT COALESCE(NULLIF(u.full_name,''),u.username),e.created
          FROM drive_events e JOIN users u ON u.id=e.actor
          WHERE e.file_id=? AND e.action IN ('created','rename','move','copy','trash','restore')
         ) WHERE changed>=? ORDER BY changed DESC LIMIT 1""",
        (row["id"], row["revision"], row["id"], row["modified"]),
    ).fetchone()
    sharing = "Workspace" if access.location(row)["workspace"] else "Private"
    cursor, seen = row, set()
    while sharing == "Private" and cursor and cursor["id"] not in seen:
        seen.add(cursor["id"])
        if (
            cursor["owner"] != row["owner"]
            or db.execute(
                """SELECT 1 FROM drive_grants g JOIN users u ON u.id=g.user_id
            JOIN drive_members m ON m.user_id=g.user_id AND m.organization=?
            WHERE g.file_id=? AND g.user_id!=? AND u.active=1 LIMIT 1""",
                (access.location(row)["organization"], cursor["id"], row["owner"]),
            ).fetchone()
            or db.execute(
                "SELECT 1 FROM drive_links WHERE file_id=? AND revoked=0 AND expires>? LIMIT 1",
                (cursor["id"], time.time()),
            ).fetchone()
        ):
            sharing = "Shared"
        cursor = (
            db.execute(
                "SELECT * FROM library WHERE id=?", (cursor["parent"],)
            ).fetchone()
            if cursor["parent"]
            else None
        )
    count = None
    if row["kind"] == "folder":
        count = sum(
            bool(access.role(child, uid))
            for child in db.execute(
                "SELECT * FROM library WHERE parent=? AND trashed=0", (row["id"],)
            )
        )
    return {
        "modified_by": modifier["author"] if modifier else None,
        "child_count": count,
        "sharing": sharing,
        "activity": dict(latest) if latest else None,
    }
