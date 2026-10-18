"""Aether Map edge-device provisioning and pairing."""

import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from core.host.library import Library
from core.host.server import StudioHost, make_handler
from core.host.state import Problem, Store
from aether_map_service.devices import DeviceStore


PAIRING_SECRET = "device-private-bootstrap-secret-for-tests"


def announce(store, data):
    return store.announce_device({**data, "pairing_secret": PAIRING_SECRET})


def test_public_device_id_does_not_disclose_or_mutate_pairing(tmp_path):
    store = DeviceStore(Store(tmp_path))
    make_user(store, "user-1", "owner")
    code = announce(store, {"device_id": "pi-private", "name": "Real device"})["code"]
    for claimed in (False, True):
        if claimed:
            store.claim_device("user-1", code)
        before = dict(store.db.execute("SELECT * FROM map_devices").fetchone())
        for data in ({"device_id": "pi-private"},
                     {"device_id": "pi-private", "pairing_secret": "wrong-secret-that-is-long-enough!!"}):
            with pytest.raises(Problem) as error:
                store.announce_device({**data, "name": "Impersonator"})
            assert error.value.status == 403
        assert dict(store.db.execute("SELECT * FROM map_devices").fetchone()) == before
    assert before["pairing_secret_hash"] == store.token_hash(PAIRING_SECRET)
    assert PAIRING_SECRET not in json.dumps(before)


def test_existing_paired_player_can_announce_with_its_current_token(tmp_path):
    store = DeviceStore(Store(tmp_path))
    make_user(store, "user-1", "owner")
    token = paired_device(store, "user-1")
    store.db.execute("UPDATE map_devices SET pairing_secret_hash='' WHERE id='pi-1'")
    store.db.commit()
    reply = store.announce_device({"device_id": "pi-1", "name": "Installed Pi"}, token=token)
    assert reply["token"] == token
    assert reply["claimed"] is True
    for invalid_token in ("aether_dev_wrong", "aether_dev_é"):
        with pytest.raises(Problem) as error:
            store.announce_device({"device_id": "pi-1"}, token=invalid_token)
        assert error.value.status == 403


def test_new_device_needs_strong_bootstrap_secret(tmp_path):
    store = DeviceStore(Store(tmp_path))
    for secret in (None, "", "short", 123, "x" * 257):
        with pytest.raises(Problem) as error:
            store.announce_device({"device_id": "pi-new", "pairing_secret": secret})
        assert error.value.status == 400
    assert store.map_devices("nobody") == []


def make_user(store, uid, username):
    """Device ownership is a real foreign key, so claims need a real user."""
    store.db.execute(
        "INSERT INTO users VALUES (?,?,?,?,1,0,'','',0,'dark','','')",
        (uid, username, "x", "admin"),
    )
    store.db.commit()


def test_first_announce_registers_the_device_and_issues_a_code(tmp_path):
    store = DeviceStore(Store(tmp_path))
    reply = announce(store, {"device_id": "pi-front-lawn", "name": "Front lawn"})

    assert reply["claimed"] is False
    assert len(reply["code"]) == 6 and reply["code"].isdigit()
    assert [d["name"] for d in store.map_devices("nobody")] == ["Front lawn"]


def test_repeated_announcements_keep_one_device_and_one_code(tmp_path):
    store = DeviceStore(Store(tmp_path))
    first = announce(store, {"device_id": "pi-1", "name": "Pi"})
    second = announce(store, {"device_id": "pi-1", "name": "Pi"})

    # A projector left running must not scroll through codes every 30 seconds.
    assert first["code"] == second["code"]
    assert len(store.map_devices("nobody")) == 1


def test_an_expired_code_rotates_so_the_projector_still_shows_a_usable_one(tmp_path):
    store = DeviceStore(Store(tmp_path))
    original = announce(store, {"device_id": "pi-1", "name": "Pi"})["code"]
    store.db.execute("UPDATE map_devices SET code_expires=1 WHERE id='pi-1'")
    store.db.commit()

    assert announce(store, {"device_id": "pi-1", "name": "Pi"})["code"] != original


def test_claiming_binds_the_device_and_consumes_the_code(tmp_path):
    store = DeviceStore(Store(tmp_path))
    make_user(store, "user-1", "owner")
    make_user(store, "user-2", "other")
    code = announce(store, {"device_id": "pi-1", "name": "Pi"})["code"]

    assert store.claim_device("user-1", code)["device_id"] == "pi-1"
    assert store.map_devices("user-1")[0]["mine"] is True
    assert store.map_devices("someone-else")[0]["mine"] is False

    # The same code must not claim it a second time.
    with pytest.raises(Problem):
        store.claim_device("user-2", code)


def test_a_claimed_device_reports_its_owner_and_stops_showing_a_code(tmp_path):
    store = DeviceStore(Store(tmp_path))
    make_user(store, "user-1", "owner")
    code = announce(store, {"device_id": "pi-1", "name": "Pi"})["code"]
    store.claim_device("user-1", code)

    reply = announce(store, {"device_id": "pi-1", "name": "Pi"})
    assert reply["claimed"] is True
    assert reply["owner"] == "owner"
    assert "code" not in reply


def test_an_unknown_code_is_refused(tmp_path):
    store = DeviceStore(Store(tmp_path))
    make_user(store, "user-1", "owner")
    announce(store, {"device_id": "pi-1", "name": "Pi"})
    with pytest.raises(Problem):
        store.claim_device("user-1", "000000")


def test_a_malformed_device_id_is_refused(tmp_path):
    store = DeviceStore(Store(tmp_path))
    for bad in ("", "../etc/passwd", "pi 1", "pi;rm -rf /"):
        with pytest.raises(Problem):
            announce(store, {"device_id": bad})


def test_device_registrations_are_capped(tmp_path):
    store = DeviceStore(Store(tmp_path))
    for index in range(store.MAP_DEVICE_LIMIT):
        announce(store, {"device_id": f"pi-{index}"})

    # Unauthenticated endpoint: an unbounded table is the abuse to prevent.
    with pytest.raises(Problem):
        announce(store, {"device_id": "one-too-many"})


def test_claiming_issues_a_device_token_and_burns_the_code(tmp_path):
    store = DeviceStore(Store(tmp_path))
    make_user(store, "user-1", "owner")
    code = announce(store, {"device_id": "pi-1", "name": "Pi"})["code"]
    store.claim_device("user-1", code)

    reply = announce(store, {"device_id": "pi-1", "name": "Pi"})
    assert reply["token"].startswith("aether_dev_")
    assert store.device_for_token(reply["token"])["id"] == "pi-1"
    # The code is spent: it must not claim anything again.
    with pytest.raises(Problem):
        store.claim_device("user-1", code)


def test_an_unclaimed_device_has_no_usable_token(tmp_path):
    store = DeviceStore(Store(tmp_path))
    announce(store, {"device_id": "pi-1", "name": "Pi"})
    assert store.device_for_token("") is None
    assert store.device_for_token("aether_dev_nonsense") is None


def test_only_the_owner_can_act_on_a_device(tmp_path):
    store = DeviceStore(Store(tmp_path))
    make_user(store, "user-1", "owner")
    make_user(store, "user-2", "other")
    code = announce(store, {"device_id": "pi-1", "name": "Pi"})["code"]
    store.claim_device("user-1", code)

    user_two = {"id": "user-2"}
    for action in ("rename", "assign", "forget"):
        with pytest.raises(Problem):
            store.map_device_action(action, user_two, {"device_id": "pi-1", "name": "X"})


def test_rename_assign_and_forget(tmp_path):
    store = DeviceStore(Store(tmp_path))
    Library(store)  # assignment checks the library; Store alone does not create it
    make_user(store, "user-1", "owner")
    owner = {"id": "user-1"}
    code = announce(store, {"device_id": "pi-1", "name": "Pi"})["code"]
    store.claim_device("user-1", code)

    store.map_device_action("rename", owner, {"device_id": "pi-1", "name": "Porch"})
    assert store.map_devices("user-1")[0]["name"] == "Porch"

    with pytest.raises(Problem):
        store.map_device_action("assign", owner, {"device_id": "pi-1", "document": "missing"})

    store.map_device_action("forget", owner, {"device_id": "pi-1"})
    assert store.map_devices("user-1") == []


def test_another_user_cannot_see_which_show_a_device_runs(tmp_path):
    store = DeviceStore(Store(tmp_path))
    make_user(store, "user-1", "owner")
    code = announce(store, {"device_id": "pi-1", "name": "Pi"})["code"]
    store.claim_device("user-1", code)
    store.db.execute("UPDATE map_devices SET document='doc-1' WHERE id='pi-1'")
    store.db.commit()

    assert store.map_devices("user-1")[0]["document"] == "doc-1"
    assert store.map_devices("user-2")[0]["document"] is None


def test_a_flood_of_announcements_from_one_address_is_refused(tmp_path):
    """The only unauthenticated write in the system must not be unbounded."""
    import json
    import threading
    import urllib.error
    import urllib.request
    from http.server import ThreadingHTTPServer

    from aether_map_service.media import ANNOUNCE_LIMIT
    from core.host.server import StudioHost, make_handler

    host = StudioHost(tmp_path)
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(host))
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/api/map/devices/announce"

    def announce(index):
        request = urllib.request.Request(
            url,
            data=json.dumps({"device_id": f"pi-{index % 8}", "pairing_secret": PAIRING_SECRET}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        return urllib.request.urlopen(request, timeout=5).status

    try:
        for index in range(ANNOUNCE_LIMIT):
            assert announce(index) == 200

        with pytest.raises(urllib.error.HTTPError) as refused:
            announce(ANNOUNCE_LIMIT)
        assert refused.value.code == 429
    finally:
        server.shutdown()


def add_show(store, file_id, owner, scope):
    store.db.execute(
        "INSERT INTO library (id,owner,app,scope,name,kind,content,created,modified)"
        " VALUES (?,?,'map',?,?,'file',?,0,0)",
        (file_id, owner, scope, file_id, b"{}"),
    )
    store.db.commit()


def paired_device(store, uid, device_id="pi-1"):
    code = announce(store, {"device_id": device_id, "name": "Pi"})["code"]
    store.claim_device(uid, code)
    return store.db.execute(
        "SELECT token FROM map_devices WHERE id=?", (device_id,)
    ).fetchone()["token"]


def test_a_stranger_s_private_show_cannot_be_deployed(tmp_path):
    """Existence is not authority: assignment reads the library as its owner."""
    store = DeviceStore(Store(tmp_path))
    Library(store)
    make_user(store, "user-1", "owner")
    make_user(store, "user-2", "other")
    add_show(store, "secret", "user-2", "personal")
    add_show(store, "shared", "user-2", "workspace")
    paired_device(store, "user-1")
    owner = {"id": "user-1"}

    with pytest.raises(Problem):
        store.map_device_action("assign", owner, {"device_id": "pi-1", "document": "secret"})

    # A show shared with the workspace is still deployable.
    assigned = store.map_device_action(
        "assign", owner, {"device_id": "pi-1", "document": "shared"}
    )
    assert assigned["document"] == "shared"


def test_withdrawing_access_withholds_the_show_from_the_device(tmp_path):
    """The projector re-reads authorization on every pull, not at deploy time."""
    instance = StudioHost(tmp_path / "data")
    store = instance.products.get("map").devices
    store.create_user("owner", "Correct-Horse-9", "admin", False)
    owner_id = store.db.execute("SELECT id FROM users WHERE username='owner'").fetchone()["id"]
    store.create_user("other", "Correct-Horse-9", "member", False)
    other_id = store.db.execute("SELECT id FROM users WHERE username='other'").fetchone()["id"]
    add_show(store, "shared", other_id, "workspace")
    token = paired_device(store, owner_id)
    store.map_device_action("assign", {"id": owner_id}, {"device_id": "pi-1", "document": "shared"})

    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(instance))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        def pull():
            reply = urllib.request.urlopen(
                urllib.request.Request(
                    f"http://127.0.0.1:{server.server_port}/api/map/device/show",
                    headers={"Authorization": "Bearer " + token},
                )
            )
            return json.loads(reply.read())

        assert pull()["show"]["id"] == "shared"

        # The show stops being shared; the projector must not keep serving it.
        store.db.execute("UPDATE library SET scope='personal' WHERE id='shared'")
        store.db.commit()
        assert pull()["show"] is None
    finally:
        server.shutdown()


def test_announce_http_requires_device_proof_and_accepts_legacy_bearer(tmp_path):
    host = StudioHost(tmp_path)
    make_user(host.store, "user-1", "owner")
    token = paired_device(host.products.get("map").devices, "user-1")
    host.store.db.execute("UPDATE map_devices SET pairing_secret_hash='' WHERE id='pi-1'")
    host.store.db.commit()
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(host))
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/api/map/devices/announce"
    def post(headers):
        return urllib.request.urlopen(urllib.request.Request(url,
            data=json.dumps({"device_id": "pi-1"}).encode(),
            headers={"Content-Type": "application/json", **headers}, method="POST"), timeout=5)
    try:
        with pytest.raises(urllib.error.HTTPError) as error:
            post({})
        assert error.value.code == 403
        with post({"Authorization": "Bearer " + token}) as response:
            assert json.load(response)["token"] == token
    finally:
        server.shutdown()
        server.server_close()


def test_legacy_pending_row_cannot_be_taken_over_by_public_id(tmp_path):
    store = DeviceStore(Store(tmp_path))
    announce(store, {"device_id": "pi-pending"})
    store.db.execute("UPDATE map_devices SET pairing_secret_hash='' WHERE id='pi-pending'")
    store.db.commit()
    with pytest.raises(Problem) as error:
        announce(store, {"device_id": "pi-pending"})
    assert error.value.status == 403


def test_legacy_database_upgrade_keeps_paired_token_and_assignment(tmp_path):
    store = DeviceStore(Store(tmp_path))
    make_user(store, "user-1", "owner")
    token = paired_device(store, "user-1")
    store.db.execute("UPDATE map_devices SET document='kept-show' WHERE id='pi-1'")
    store.db.execute("ALTER TABLE map_devices DROP COLUMN pairing_secret_hash")
    store.db.commit()
    store.db.close()
    upgraded = DeviceStore(Store(tmp_path))
    reply = upgraded.announce_device({"device_id": "pi-1"}, token=token)
    assert reply["token"] == token
    assert upgraded.device_for_token(token)["document"] == "kept-show"
    assert upgraded.device_for_token(token)["pairing_secret_hash"] == ""


def test_device_proof_is_bound_to_its_device_id(tmp_path):
    store = DeviceStore(Store(tmp_path))
    make_user(store, "user-1", "owner")
    tokens = []
    for device_id, secret in (("pi-a", "a" * 43), ("pi-b", "b" * 43)):
        data = {"device_id": device_id, "pairing_secret": secret}
        code = store.announce_device(data)["code"]
        store.claim_device("user-1", code)
        tokens.append(store.announce_device(data)["token"])
    for data, token in (({"device_id": "pi-b", "pairing_secret": "a" * 43}, ""),
                        ({"device_id": "pi-b"}, tokens[0])):
        with pytest.raises(Problem) as error:
            store.announce_device(data, token=token)
        assert error.value.status == 403
