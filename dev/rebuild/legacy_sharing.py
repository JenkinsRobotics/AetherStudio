"""Preserve factual direct-grant provenance; never synthesize a grantor or date."""
import math


def extract(db, require):
    columns = {r[1] for r in db.execute("PRAGMA table_info(drive_grants)")}
    core = {"file_id", "user_id", "role"}
    require(core <= columns <= core | {"shared_by", "shared_at"}, "Unsupported sharing fields.")
    users = {r[0] for r in db.execute("SELECT id FROM users")}
    files = {r[0] for r in db.execute("SELECT id FROM library")}
    fields = ["file_id", "user_id", "role", "shared_by" if "shared_by" in columns else "NULL", "shared_at" if "shared_at" in columns else "NULL"]
    result, seen = [], set()
    for resource, user, role, author, at in db.execute("SELECT " + ",".join(fields) + " FROM drive_grants"):
        require(resource in files and user in users and role in {"viewer", "editor", "owner"}, "Invalid sharing target or role.")
        require((resource, user) not in seen, "Duplicate sharing grant.")
        seen.add((resource, user))
        require(author is None or author in users, "Missing sharing author.")
        require(at is None or (type(at) in (int, float) and math.isfinite(at) and at >= 0), "Invalid sharing timestamp.")
        if author is not None or at is not None:
            result.append({"resource": resource, "user_id": user, "shared_by": author, "shared_at": at})
    return sorted(result, key=lambda r: (r["resource"], r["user_id"]))
