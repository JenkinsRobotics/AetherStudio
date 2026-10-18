"""No paid inference: deterministic runtime boundary and real host authorization."""

import threading
import time
import zipfile

import pytest

from core.host.agents import Agents
from core.host.agents.runtime import environment, login_url
from core.host.server import StudioHost
from core.host.state import Problem


class FakeRuntime:
    def __init__(self):
        self.ready = set()
        self.gate = threading.Event()
        self.payloads = []

    def installed(self, provider):
        return provider in self.ready

    def install(self, provider, job):
        self.ready.add(provider)

    def disconnect(self, provider, directory, job):
        pass

    def run(self, provider, action, directory, payload, job):
        self.payloads.append((provider, action, directory, payload))
        if action == "login":
            job.event({"type": "connected", "label": directory.parent.name[:8]})
        elif action == "models":
            job.event({"type": "models", "models": [{"id": "test", "name": "Test"}]})
        else:
            job.event({"type": "delta", "text": "Partial"})
            while not self.gate.wait(0.01) and not job.cancelled:
                pass
            job.event({"type": "delta", "text": " response"})


@pytest.fixture
def service(tmp_path):
    runtime = FakeRuntime()
    agents = Agents(tmp_path, runtime)
    return agents, runtime


def wait(agents, job, user="owner"):
    for _ in range(200):
        result = agents.dispatch(user, True, "job", {"id": job["id"]})
        if result["state"] != "running":
            return result
        time.sleep(0.005)
    raise AssertionError("Job did not finish")


def start(agents, action, user="owner", **extra):
    return agents.dispatch(
        user, user == "owner", action, {"provider": "chatgpt", **extra}
    )


def connected(agents):
    assert wait(agents, start(agents, "install"))["state"] == "completed"
    assert wait(agents, start(agents, "login"))["state"] == "completed"


def test_curated_marketplace_install_enable_persists_and_members_cannot_install(
    service,
):
    agents, runtime = service
    assert {p["id"] for p in agents.catalog("owner")["plugins"]} == {
        "chatgpt",
        "claude",
        "gemini",
    }
    assert all(
        not p["capabilities"]["videoGeneration"]
        for p in agents.catalog("owner")["plugins"]
    )
    with pytest.raises(Problem) as error:
        start(agents, "install", "member")
    assert error.value.status == 403
    connected(agents)
    start(agents, "disable")
    reopened = Agents(agents.root.parent, runtime)
    assert reopened.catalog("owner")["plugins"][0]["installed"]
    assert not reopened.catalog("owner")["plugins"][0]["enabled"]
    with pytest.raises(Problem):
        start(reopened, "chat", messages=[{"role": "user", "content": "Hello"}])
    start(reopened, "enable")
    assert reopened.catalog("owner")["plugins"][0]["enabled"]


def test_personal_accounts_jobs_and_disconnect_are_isolated(service):
    agents, runtime = service
    connected(agents)
    assert not agents.catalog("member")["plugins"][0]["account"]
    job = start(agents, "login", "member")
    assert wait(agents, job, "member")["state"] == "completed"
    with pytest.raises(Problem) as error:
        agents.dispatch("owner", True, "job", {"id": job["id"]})
    assert error.value.status == 404
    assert runtime.payloads[0][2] != runtime.payloads[1][2]
    wait(agents, start(agents, "disconnect"))
    assert not agents.catalog("owner")["plugins"][0]["account"]
    assert agents.catalog("member")["plugins"][0]["account"]["connected"]


def test_disable_cancels_stream_and_blocks_late_events(service):
    agents, runtime = service
    connected(agents)
    job = start(
        agents,
        "chat",
        messages=[{"role": "user", "content": "Hello"}],
        context="Scene 1",
    )
    start(agents, "disable")
    result = wait(agents, job)
    assert result["state"] == "cancelled"
    runtime.gate.set()
    time.sleep(0.03)
    assert " response" not in agents.jobs[job["id"]].text
    assert "no document-editing" in runtime.payloads[-1][3]["instructions"]


def test_invalid_provider_and_conversation_and_inherited_credentials(
    service, monkeypatch
):
    agents, _ = service
    connected(agents)
    with pytest.raises(Problem):
        agents.dispatch("owner", True, "install", {"provider": "../../x"})
    for messages in (
        [],
        [{"role": "system", "content": "bad"}],
        [{"role": "user", "content": "x" * 100001}],
    ):
        with pytest.raises(Problem):
            start(agents, "chat", messages=messages)
    monkeypatch.setenv("OPENAI_API_KEY", "never-inherit")
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "never-inherit")
    env = environment(agents.root, "claude")
    assert "OPENAI_API_KEY" not in env and "ANTHROPIC_AUTH_TOKEN" not in env
    assert env["CLAUDE_CONFIG_DIR"].startswith(str(agents.root))
    assert login_url("https://auth.openai.com/api/accounts/authorize?state=abc")
    assert not login_url("https://auth.openai.com.evil.test/authorize")
    assert not login_url("javascript:alert(1)")


def test_host_auth_and_backup_excludes_provider_credentials(tmp_path):
    host = StudioHost(tmp_path)
    uid = host.store.create_user("owner", "agent-test-password-2026", "admin", False)
    token = host.store.sign_in("owner", "agent-test-password-2026", "local")
    with pytest.raises(Problem) as error:
        host.dispatch("/api/agent/catalog", {}, "", "local")
    assert error.value.status == 401
    assert len(host.dispatch("/api/agent/catalog", {}, token, "local")["plugins"]) == 3
    secret = host.agents.directory(uid, "chatgpt")
    secret.mkdir(parents=True)
    (secret / "account.json").write_text("private credential fixture")
    host.backup()
    archive = next((tmp_path / "backups").glob("*.zip"))
    with zipfile.ZipFile(archive) as zipped:
        assert not any("agents/" in entry for entry in zipped.namelist())


def test_host_signout_stops_the_users_running_provider_job(tmp_path):
    host = StudioHost(tmp_path)
    user = host.store.create_user("owner", "agent-test-password-2026", "admin", False)
    token = host.store.sign_in("owner", "agent-test-password-2026", "local")
    host.agents = Agents(tmp_path, FakeRuntime())
    host.store.db.execute("UPDATE applications SET enabled=1 WHERE id='map'")

    def request(action, **data):
        return host.dispatch(
            "/api/agent/" + action, {"provider": "chatgpt", **data}, token, "local"
        )

    wait(host.agents, request("install"), user)
    wait(host.agents, request("login"), user)
    job = request("chat", app="map", messages=[{"role": "user", "content": "Hello"}])
    host.dispatch("/api/logout", {}, token, "local")
    assert host.agents.jobs[job["id"]].state == "cancelled"
    with pytest.raises(Problem) as error:
        request("job", id=job["id"])
    assert error.value.status == 401
