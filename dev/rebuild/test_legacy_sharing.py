import sqlite3

import pytest

from dev.rebuild.legacy_sharing import extract
from dev.rebuild.legacy_transfer import TransferError, require


@pytest.fixture
def source():
    with sqlite3.connect(":memory:") as db:
        db.executescript("CREATE TABLE users(id); CREATE TABLE library(id); INSERT INTO users VALUES('alice'),('bob'); INSERT INTO library VALUES('file'); CREATE TABLE drive_grants(file_id,user_id,role,shared_by,shared_at); INSERT INTO drive_grants VALUES('file','bob','viewer','alice',1234.125);")
        yield db


def test_sharing_preserves_exact_facts_and_unknowns(source):
    assert extract(source,require)==[{"resource":"file","user_id":"bob","shared_by":"alice","shared_at":1234.125}]
    source.execute("UPDATE drive_grants SET shared_by=NULL")
    assert extract(source,require)[0]["shared_by"] is None
    source.execute("UPDATE drive_grants SET shared_at=NULL")
    assert extract(source,require)==[]
    source.executescript("ALTER TABLE drive_grants DROP COLUMN shared_by; ALTER TABLE drive_grants DROP COLUMN shared_at;")
    assert extract(source,require)==[]


@pytest.mark.parametrize("damage",[
    "UPDATE drive_grants SET shared_by='missing'",
    "UPDATE drive_grants SET user_id='missing'",
    "UPDATE drive_grants SET file_id='missing'",
    "UPDATE drive_grants SET role='superuser'",
    "UPDATE drive_grants SET shared_at=-1",
    "UPDATE drive_grants SET shared_at='yesterday'",
    "UPDATE drive_grants SET shared_at=1e999",
    "INSERT INTO drive_grants SELECT * FROM drive_grants",
    "ALTER TABLE drive_grants ADD COLUMN unknown_future_field",
])
def test_sharing_refuses_loss_or_invalid_facts(source,damage):
    source.execute(damage)
    with pytest.raises(TransferError): extract(source,require)
