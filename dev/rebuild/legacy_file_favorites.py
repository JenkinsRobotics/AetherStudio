"""Import personal file favorites without inventing historical operations."""


def extract(db, require):
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "drive_favorites" not in tables:
        return []
    columns = {r[1] for r in db.execute("PRAGMA table_info(drive_favorites)")}
    require(columns == {"user_id", "file_id"}, "Unsupported file favorite fields.")
    users = {r[0] for r in db.execute("SELECT id FROM users")}
    files = {r[0] for r in db.execute("SELECT id FROM library")}
    result = []
    seen = set()
    for user, resource in db.execute("SELECT user_id,file_id FROM drive_favorites"):
        require(isinstance(user, str) and user in users and isinstance(resource, str)
                and resource in files, "Invalid file favorite owner or resource.")
        require((user, resource) not in seen, "Duplicate file favorite.")
        seen.add((user, resource))
        result.append({"user_id": user, "resource": resource, "favorite": True, "revision": 0})
    return sorted(result, key=lambda r: (r["user_id"], r["resource"]))
