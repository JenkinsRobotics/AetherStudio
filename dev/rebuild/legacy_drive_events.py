"""Read exact Drive activity facts, including retained events for purged files."""
import math


def extract(db, require):
    columns = {r[1] for r in db.execute("PRAGMA table_info(drive_events)")}
    if not columns:
        return []
    require(columns == {"id", "organization", "file_id", "actor", "action", "created", "detail"}, "Unsupported Drive activity fields.")
    users = {r[0] for r in db.execute("SELECT id FROM users")}
    files = {r[0] for r in db.execute("SELECT id FROM library")}
    orgs = {r[0] for r in db.execute("SELECT id FROM drive_organizations")}
    result, seen = [], set()
    for ident, org, file, actor, action, created, detail in db.execute("SELECT id,organization,file_id,actor,action,created,detail FROM drive_events ORDER BY id"):
        require(type(ident) is int and 0 < ident <= 9223372036854775807 and ident not in seen, "Invalid Drive activity ID.")
        seen.add(ident)
        require(org in orgs and actor in users and (file is None or file in files), "Missing Drive activity reference.")
        require(isinstance(action, str) and action and "\0" not in action and isinstance(detail, str) and "\0" not in detail, "Invalid Drive activity text.")
        require(type(created) in (int, float) and math.isfinite(created) and created >= 0, "Invalid Drive activity timestamp.")
        result.append({"id": ident, "organization": org, "file_id": file, "actor": actor, "action": action, "created": created, "detail": detail})
    return result
