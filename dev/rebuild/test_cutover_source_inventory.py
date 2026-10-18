import hashlib
import json
import sqlite3

import pytest

from dev.rebuild.cutover_source_inventory import compare


def source(path, uid, username, files, history):
    db = sqlite3.connect(path)
    db.executescript("CREATE TABLE users(id TEXT,username TEXT); CREATE TABLE library(id TEXT); CREATE TABLE library_history(revision INTEGER);")
    db.execute("INSERT INTO users VALUES(?,?)", (uid, username))
    db.executemany("INSERT INTO library VALUES(?)", [(f,) for f in files])
    db.executemany("INSERT INTO library_history VALUES(?)", [(n,) for n in range(history)])
    db.commit()
    db.close()
    return path


def test_unique_work_and_identity_conflicts_are_reported_without_private_details(tmp_path):
    a = source(tmp_path / "a.db", "original-user", "SamePerson", ["original-file"], 4)
    b = source(tmp_path / "b.db", "dev-user", "sameperson", ["dev-file"], 2)
    before = [hashlib.sha256(p.read_bytes()).hexdigest() for p in [a, b]]
    report = compare(a, b)
    assert report["original_only_files"] == report["development_only_files"] == 1
    assert report["same_username_different_id"] == 1
    assert report["counts"]["original"]["history"] == 4
    assert report["shared_file_ids"] == 0
    assert report["cutover_ready"] is False
    encoded = json.dumps(report)
    for value in ["SamePerson", "sameperson", "original-user", "original-file", "dev-user", "dev-file"]:
        assert value not in encoded
    assert before == [hashlib.sha256(p.read_bytes()).hexdigest() for p in [a, b]]


def test_matching_ids_do_not_claim_reconciliation_or_readiness(tmp_path):
    a = source(tmp_path / "a.db", "same", "user", ["common"], 3)
    b = source(tmp_path / "b.db", "same", "user", ["common"], 9)
    report = compare(a, b)
    assert report["shared_file_ids"] == 1
    assert report["same_username_different_id"] == 0
    assert report["counts"]["development"]["history"] == 9
    assert report["cutover_ready"] is False


def test_missing_or_duplicate_sources_refuse_without_creating_a_database(tmp_path):
    a = source(tmp_path / "a.db", "a", "user", [], 0)
    missing = tmp_path / "missing.db"
    with pytest.raises(ValueError):
        compare(a, missing)
    assert not missing.exists()
    with pytest.raises(ValueError):
        compare(a, a)
