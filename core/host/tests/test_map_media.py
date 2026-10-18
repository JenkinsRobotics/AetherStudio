"""Aether Map media store: naming rules and Range reads."""

import pytest

from core.host.library import Library
from aether_map_service.media import MEDIA_EXTENSIONS, media_in_use, media_target
from core.host.state import Problem, Store
from aether_map_service.devices import DeviceStore


def test_a_valid_name_resolves_inside_the_media_store(tmp_path):
    target = media_target(tmp_path, "abc123.mp4")
    assert target.parent == tmp_path / "map-media"
    assert target.name == "abc123.mp4"
    assert target.parent.is_dir()


def test_the_extension_is_normalised_but_the_id_is_not(tmp_path):
    assert media_target(tmp_path, "Clip-1.MP4").name == "Clip-1.mp4"


def test_path_traversal_and_junk_names_are_refused(tmp_path):
    for bad in (
        "../../etc/passwd",
        "../escape.mp4",
        "a/b.mp4",
        "no-extension",
        ".mp4",
        "shell;rm.mp4",
        "space name.png",
        "x" * 65 + ".png",
    ):
        with pytest.raises(Problem):
            media_target(tmp_path, bad)


def test_executable_and_unknown_formats_are_refused(tmp_path):
    for bad in ("payload.sh", "page.html", "doc.pdf", "archive.zip", "clip.mkv"):
        with pytest.raises(Problem):
            media_target(tmp_path, bad)


def test_the_supported_formats_are_images_and_video(tmp_path):
    for extension in MEDIA_EXTENSIONS:
        assert media_target(tmp_path, "id" + extension).suffix == extension


class FakeHost:
    """media_in_use only needs a store with a library table."""

    def __init__(self, store):
        self.store = store


def seed_show(store, name, media_file):
    """A saved .aethermap row. Library rows reference a real user."""
    import json
    import secrets
    import time

    store.db.execute(
        "INSERT OR IGNORE INTO users VALUES (?,?,?,?,1,0,'','',0,'dark','','')",
        ("u1", "owner", "x", "admin"),
    )

    content = json.dumps(
        {
            "version": 1,
            "media": [{"id": "m1", "file": media_file, "name": media_file}],
            "surfaces": [],
        }
    ).encode()
    store.db.execute(
        "INSERT INTO library (id,owner,app,scope,parent,name,kind,content,created,modified)"
        " VALUES (?,?,?,?,?,?,?,?,?,?)",
        (secrets.token_hex(8), "u1", "map", "personal", None, name, "file",
         content, time.time(), time.time()),
    )
    store.db.commit()


def test_media_referenced_by_a_saved_show_is_in_use(tmp_path):
    store = DeviceStore(Store(tmp_path))
    Library(store)
    seed_show(store, "Show.aethermap", "used1.png")

    assert media_in_use(FakeHost(store), "used1.png") is True
    assert media_in_use(FakeHost(store), "orphan1.png") is False


def test_a_trashed_show_does_not_keep_media_alive(tmp_path):
    store = DeviceStore(Store(tmp_path))
    Library(store)
    seed_show(store, "Show.aethermap", "used1.png")
    store.db.execute("UPDATE library SET trashed=1")
    store.db.commit()

    assert media_in_use(FakeHost(store), "used1.png") is False


def test_a_partial_filename_does_not_count_as_a_reference(tmp_path):
    store = DeviceStore(Store(tmp_path))
    Library(store)
    seed_show(store, "Show.aethermap", "clip10.png")

    # The scan matches the quoted JSON string, so a shorter name must not
    # match inside a longer one.
    assert media_in_use(FakeHost(store), "clip10.png") is True
    assert media_in_use(FakeHost(store), "clip1.png") is False


def test_one_filename_cannot_match_inside_another(tmp_path):
    store = DeviceStore(Store(tmp_path))
    Library(store)
    seed_show(store, "Show.aethermap", "xa.png")

    assert media_in_use(FakeHost(store), "xa.png") is True
    assert media_in_use(FakeHost(store), "a.png") is False


def test_soundtrack_audio_formats_resolve_inside_media_store(tmp_path):
    for extension in (".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"):
        assert media_target(tmp_path, "soundtrack" + extension).suffix == extension
