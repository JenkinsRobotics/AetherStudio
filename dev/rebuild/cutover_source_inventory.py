"""Read-only comparison of legacy authorities; never merges or rewrites data.

Only aggregate counts leave this process. An equal username is a potential
identity conflict, not permission to combine accounts. Separate read transactions
are inventories, not a final cross-authority backup; drain writes before capture.
"""
import argparse
import json
import sqlite3
from pathlib import Path


def read_source(path: Path):
    if path.is_symlink() or not path.is_file():
        raise ValueError("Expected a regular existing SQLite database.")
    db = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    try:
        db.execute("PRAGMA query_only=ON")
        db.execute("BEGIN")
        users = dict(db.execute("SELECT id,username FROM users"))
        files = {row[0] for row in db.execute("SELECT id FROM library")}
        history = db.execute("SELECT count(*) FROM library_history").fetchone()[0]
        return {"users": users, "files": files, "history": history}
    finally:
        db.close()


def compare(original: Path, development: Path):
    if original.resolve() == development.resolve():
        raise ValueError("Choose two different authorities.")
    sources = {"original": read_source(original), "development": read_source(development)}
    a, b = sources.values()
    return {
        "counts": {name: {"users": len(s["users"]), "library": len(s["files"]),
                          "history": s["history"]} for name, s in sources.items()},
        "shared_file_ids": len(a["files"] & b["files"]),
        "original_only_files": len(a["files"] - b["files"]),
        "development_only_files": len(b["files"] - a["files"]),
        "same_username_different_id": sum(
            ua.casefold() == ub.casefold() and ia != ib
            for ia, ua in a["users"].items() for ib, ub in b["users"].items()
        ),
        "cutover_ready": False,
        "note": "Aggregate inventory only; shared IDs are not compared for content equality. "
                "Separate live read transactions are not a consistent backup. "
                "No automatic account mapping or history merge is authorized by this report.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original", type=Path, required=True)
    parser.add_argument("--development", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(compare(args.original, args.development), indent=2))


if __name__ == "__main__":
    main()
