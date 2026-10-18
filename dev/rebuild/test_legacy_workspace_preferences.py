import sqlite3

import pytest

from dev.rebuild.legacy_transfer import TransferError, require
from dev.rebuild.legacy_workspace_preferences import extract


@pytest.fixture
def source():
    with sqlite3.connect(":memory:") as db:
        db.executescript("CREATE TABLE users(id); CREATE TABLE drive_workspaces(id); INSERT INTO users VALUES('alice'); INSERT INTO drive_workspaces VALUES('shared'); CREATE TABLE drive_workspace_preferences(user_id,workspace,favorite,opened); INSERT INTO drive_workspace_preferences VALUES('alice','shared',1,123.125);")
        yield db


def test_workspace_preferences_preserve_fields_as_a_baseline(source):
    assert extract(source, require) == [{"user_id": "alice", "workspace": "shared", "favorite": True, "opened": 123.125, "revision": 0}]
    source.execute("UPDATE drive_workspace_preferences SET favorite=0,opened=NULL")
    assert extract(source, require) == [{"user_id": "alice", "workspace": "shared", "favorite": False, "opened": None, "revision": 0}]
    source.execute("DROP TABLE drive_workspace_preferences")
    assert extract(source, require) == []


@pytest.mark.parametrize("damage", [
    "UPDATE drive_workspace_preferences SET favorite=2",
    "UPDATE drive_workspace_preferences SET favorite='yes'",
    "UPDATE drive_workspace_preferences SET user_id='missing'",
    "UPDATE drive_workspace_preferences SET workspace='missing'",
    "UPDATE drive_workspace_preferences SET opened=-1",
    "UPDATE drive_workspace_preferences SET opened='not a timestamp'",
    "UPDATE drive_workspace_preferences SET opened=1e999",
    "INSERT INTO drive_workspace_preferences SELECT * FROM drive_workspace_preferences",
    "ALTER TABLE drive_workspace_preferences ADD COLUMN unknown_future_field",
])
def test_workspace_preferences_refuse_invalid_or_unknown_data(source, damage):
    source.execute(damage)
    with pytest.raises(TransferError):
        extract(source, require)
