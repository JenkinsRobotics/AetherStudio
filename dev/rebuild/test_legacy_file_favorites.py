"""File favorite migration refuses loss or ambiguous personal ownership."""
import sqlite3

import pytest

from dev.rebuild.legacy_file_favorites import extract
from dev.rebuild.legacy_transfer import TransferError, require


@pytest.fixture
def source():
    with sqlite3.connect(":memory:") as db:
        db.executescript("CREATE TABLE users(id); CREATE TABLE library(id); INSERT INTO users VALUES('alice'); INSERT INTO library VALUES('file'); CREATE TABLE drive_favorites(user_id,file_id); INSERT INTO drive_favorites VALUES('alice','file');")
        yield db

def test_file_favorites_preserve_baseline_without_inventing_events(source):
    assert extract(source, require) == [{"user_id":"alice","resource":"file","favorite":True,"revision":0}]
    source.execute("DROP TABLE drive_favorites")
    assert extract(source, require) == []

@pytest.mark.parametrize("damage", [
    "UPDATE drive_favorites SET user_id='missing'",
    "UPDATE drive_favorites SET file_id='missing'",
    "UPDATE drive_favorites SET user_id=NULL",
    "UPDATE drive_favorites SET file_id=NULL",
    "INSERT INTO drive_favorites SELECT * FROM drive_favorites",
    "ALTER TABLE drive_favorites ADD COLUMN unknown_future_field",
])
def test_file_favorites_refuse_ambiguous_or_unknown_records(source, damage):
    source.execute(damage)
    with pytest.raises(TransferError):
        extract(source, require)
