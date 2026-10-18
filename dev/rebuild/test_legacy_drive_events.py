import sqlite3

import pytest

from dev.rebuild.legacy_drive_events import extract
from dev.rebuild.legacy_transfer import TransferError, require


@pytest.fixture
def source():
    with sqlite3.connect(":memory:") as db:
        db.executescript("CREATE TABLE users(id); CREATE TABLE library(id); CREATE TABLE drive_organizations(id); INSERT INTO users VALUES('alice'); INSERT INTO library VALUES('file'); INSERT INTO drive_organizations VALUES('org'); CREATE TABLE drive_events(id,organization,file_id,actor,action,created,detail); INSERT INTO drive_events VALUES(1,'org','file','alice','trash',1234.125,'Exact name'); INSERT INTO drive_events VALUES(2,'org',NULL,'alice','delete_forever',1235.5,'Deleted name');")
        yield db

def test_exact_activity_and_purged_file_facts(source):
    assert extract(source,require)==[
      {"id":1,"organization":"org","file_id":"file","actor":"alice","action":"trash","created":1234.125,"detail":"Exact name"},
      {"id":2,"organization":"org","file_id":None,"actor":"alice","action":"delete_forever","created":1235.5,"detail":"Deleted name"}]

@pytest.mark.parametrize("damage",[
 "UPDATE drive_events SET actor='missing'", "UPDATE drive_events SET organization='missing'", "UPDATE drive_events SET file_id='missing'",
 "UPDATE drive_events SET id=0", "INSERT INTO drive_events SELECT * FROM drive_events", "UPDATE drive_events SET created=-1", "UPDATE drive_events SET created=1e999",
 "UPDATE drive_events SET action=NULL", "UPDATE drive_events SET detail=NULL", "ALTER TABLE drive_events ADD COLUMN future",
])
def test_refuse_unrepresentable_activity(source,damage):
    source.execute(damage)
    with pytest.raises(TransferError): extract(source,require)
