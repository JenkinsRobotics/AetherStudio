"""Mirroring is temporary, scoped to a pairing, and never deploys a show."""
import pytest
from aether_map_service.cast import MapCast
from core.host.state import Problem


@pytest.fixture
def casting():
    now = [0]
    relay = MapCast(clock=lambda: now[0])
    device = {"id": "pi", "token": "secret", "document": "saved-show"}
    return relay, device, now


def test_offer_answer_stop_and_assignment_unchanged(casting):
    relay, device, _ = casting
    started = relay.owner(device, "cast-start", {"sdp": "v=0\r\no=sender"})
    sid = started["session_id"]
    assert "token" not in started
    offer = relay.player(device)["session"]
    assert offer["offer"]["type"] == "offer"
    relay.player(device, {"session_id": sid, "sdp": "v=0\r\no=receiver", "state": "connected"})
    answer = relay.owner(device, "cast-poll", {"session_id": sid})
    assert answer["answer"]["type"] == "answer"
    assert answer["state"] == "connected"
    relay.owner(device, "cast-stop", {"session_id": sid})
    assert relay.player(device) == {"session": None}
    assert device["document"] == "saved-show"


def test_lost_sender_expires_and_new_pairing_cannot_inherit(casting):
    relay, device, now = casting
    relay.owner(device, "cast-start", {"sdp": "v=0"})
    now[0] = 21
    assert relay.player(device)["session"] is None
    relay.owner(device, "cast-start", {"sdp": "v=0"})
    assert relay.player({**device, "token": "new-pairing"})["session"] is None


def test_stale_controls_cannot_stop_new_cast_or_replace_answer(casting):
    relay, device, _ = casting
    relay.owner(device, "cast-start", {"sdp": "v=0"})
    for action in ("cast-stop", "cast-poll", "cast-start"):
        with pytest.raises(Problem):
            relay.owner(device, action, {"session_id": "old", "sdp": "v=0"})
    with pytest.raises(Problem):
        relay.player(device, {"session_id": "old", "sdp": "v=0"})


def test_heartbeats_renew_but_receiver_poll_does_not(casting):
    relay, device, now = casting
    sid = relay.owner(device, "cast-start", {"sdp": "v=0"})["session_id"]
    now[0] = 19
    relay.owner(device, "cast-poll", {"session_id": sid})
    now[0] = 25
    assert relay.player(device)["session"] is not None
    now[0] = 40
    assert relay.player(device)["session"] is None


@pytest.mark.parametrize("sdp", [None, {}, "no", "v=0" + "x" * 65536])
def test_invalid_descriptions_rejected(casting, sdp):
    relay, device, _ = casting
    with pytest.raises(Problem):
        relay.owner(device, "cast-start", {"sdp": sdp})


def test_host_owner_scope_and_device_bearer_routes(tmp_path):
    import json
    import threading
    from http.server import ThreadingHTTPServer
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError
    from core.host.server import StudioHost, make_handler
    from core.host.tests.test_map_devices import make_user, paired_device

    host = StudioHost(tmp_path)
    make_user(host.store, "owner", "owner")
    make_user(host.store, "stranger", "stranger")
    token = paired_device(host.products.get("map").devices, "owner")
    # Keep dispatch's ownership/app checks; replace only session lookup.
    host.require_user = lambda login, **kw: {"id": login, "role": "admin", "username": login, "apps": ["map"]}
    with pytest.raises(Problem) as refused:
        host.dispatch("/api/map/devices/cast-start", {"device_id": "pi-1", "sdp": "v=0"}, "stranger", "127.0.0.1")
    assert refused.value.status == 403
    started = host.dispatch("/api/map/devices/cast-start", {"device_id": "pi-1", "sdp": "v=0"}, "owner", "127.0.0.1")
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(host))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}/api/map/device/cast"
    try:
        for method in ("GET", "POST"):
            with pytest.raises(HTTPError) as refused:
                urlopen(Request(url, method=method, data=b"{}" if method == "POST" else None), timeout=3)
            assert refused.value.code == 401
        with urlopen(Request(url, headers={"Authorization": "Bearer " + token}), timeout=3) as response:
            assert json.load(response)["session"]["id"] == started["session_id"]
        body = json.dumps({"session_id": started["session_id"], "sdp": "v=0", "state": "connected"}).encode()
        with urlopen(Request(url, data=body, headers={"Authorization": "Bearer " + token}), timeout=3) as response:
            assert response.status == 200
        host.products.get("map").devices.map_device_action("forget", {"id": "owner"}, {"device_id": "pi-1"})
        with pytest.raises(HTTPError) as refused:
            urlopen(Request(url, headers={"Authorization": "Bearer " + token}), timeout=3)
        assert refused.value.code == 401
    finally:
        server.shutdown()
        server.server_close()
