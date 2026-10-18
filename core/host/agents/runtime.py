"""Official account runtimes. No inherited API credentials or host tools."""

import json
import os
import queue
import re
import shutil
import subprocess
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).parent
PACKAGES = {
    "claude": "@anthropic-ai/claude-code@2.1.286",
    "gemini": "@google/gemini-cli@0.62.0",
}
LOGIN_HOSTS = {
    "auth.openai.com",
    "claude.ai",
    "platform.claude.com",
    "console.anthropic.com",
    "accounts.google.com",
}


def environment(directory, provider):
    # Deliberately exclude ambient API keys, OAuth tokens, hooks and provider URLs.
    env = {
        key: os.environ[key]
        for key in ("PATH", "SYSTEMROOT", "LANG", "TMPDIR")
        if key in os.environ
    }
    env.update(
        {
            "CLAUDE_CONFIG_DIR": str(directory / "claude"),
            "GEMINI_CLI_HOME": str(directory / "gemini"),
            "GEMINI_FORCE_FILE_STORAGE": "true",
        }
    )
    return env


def login_url(value):
    try:
        url = urlsplit(value)
        return (
            url.scheme == "https" and url.hostname in LOGIN_HOSTS and not url.username
        )
    except ValueError:
        return False


class Runtime:
    def __init__(self, root):
        self.root = root

    def installed(self, provider):
        if provider == "chatgpt":
            return bool(shutil.which("node"))
        return (
            self.root
            / provider
            / "node_modules"
            / ".bin"
            / ("claude" if provider == "claude" else "gemini")
        ).is_file()

    def install(self, provider, job):
        if not shutil.which("node"):
            raise RuntimeError("Install Node.js 22 or newer on the Studio host first.")
        check = job.spawn(
            [shutil.which("node"), "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        version = check.communicate(timeout=10)[0].strip()
        if check.returncode or int(version.lstrip("v").split(".")[0]) < 22:
            raise RuntimeError("Install Node.js 22 or newer on the Studio host first.")
        if provider == "chatgpt":
            return
        npm = shutil.which("npm")
        if not npm:
            raise RuntimeError("Install npm on the Studio host first.")
        target = self.root / provider
        target.mkdir(parents=True, exist_ok=True, mode=0o700)
        process = job.spawn(
            [
                npm,
                "install",
                "--prefix",
                str(target),
                "--no-audit",
                "--no-fund",
                "--save-exact",
                PACKAGES[provider],
            ],
            cwd=target,
            env=environment(target, provider),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if process.wait(timeout=300):
            raise RuntimeError(
                "Provider installation failed. Check the host's network and Node.js installation."
            )

    def disconnect(self, provider, directory, job):
        if provider == "claude" and self.installed(provider):
            binary = self.root / provider / "node_modules" / ".bin" / "claude"
            process = job.spawn(
                [str(binary), "auth", "logout"],
                env=environment(directory, provider),
                cwd=directory,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if process.wait(timeout=30):
                raise RuntimeError(
                    "Claude could not disconnect. Try again before uninstalling."
                )

    def run(self, provider, action, directory, payload, job):
        env = environment(directory, provider)
        work = directory / "workspace"
        work.mkdir(parents=True, exist_ok=True, mode=0o700)
        if provider == "chatgpt":
            process = job.spawn(
                [
                    shutil.which("node"),
                    str(ROOT / "chatgpt.mjs"),
                    action,
                    str(directory / "chatgpt"),
                ],
                env=env,
                cwd=work,
            )
            if action == "chat":
                process.stdin.write(json.dumps(payload) + "\n")
                process.stdin.flush()
            for line in process.stdout:
                try:
                    event = json.loads(line)
                except ValueError:
                    continue
                job.event(event)
            if process.wait() and not job.error:
                raise RuntimeError("ChatGPT connection failed. Reconnect in Plugins.")
            return
        binary = str(
            self.root
            / provider
            / "node_modules"
            / ".bin"
            / ("claude" if provider == "claude" else "gemini")
        )
        if provider == "claude":
            self.claude(binary, action, work, env, payload, job)
        else:
            self.gemini(binary, action, work, directory, env, payload, job)

    def claude(self, binary, action, work, env, payload, job):
        if action == "login":
            process = job.spawn(
                [binary, "auth", "login", "--claudeai"],
                env=env,
                cwd=work,
                stderr=subprocess.STDOUT,
            )
            # CLI outputs an authorization URL while its loopback callback waits.
            self.auth_output(process, job)
            if process.wait():
                raise RuntimeError(
                    "Claude sign-in did not complete. Try again on the Studio host."
                )
        if action in ("login", "status", "models"):
            process = job.spawn([binary, "auth", "status"], env=env, cwd=work)
            output = process.communicate(timeout=30)[0]
            try:
                account = json.loads(output)
            except ValueError:
                account = {}
            if (
                process.returncode
                or not account.get("loggedIn")
                or account.get("authMethod") not in ("claude.ai", "oauth")
            ):
                raise RuntimeError("Sign in using a Claude subscription in Plugins.")
            job.event(
                {"type": "connected", "label": account.get("email") or "Claude account"}
            )
            if action == "models":
                job.event(
                    {
                        "type": "models",
                        "models": [
                            {"id": "", "name": "Account default"},
                            {"id": "sonnet", "name": "Sonnet"},
                            {"id": "opus", "name": "Opus"},
                            {"id": "haiku", "name": "Haiku"},
                        ],
                    }
                )
            return
        args = [
            binary,
            "-p",
            "--output-format",
            "stream-json",
            "--verbose",
            "--include-partial-messages",
            "--tools",
            "",
            "--strict-mcp-config",
            "--mcp-config",
            '{"mcpServers":{}}',
            "--setting-sources",
            "",
            "--no-session-persistence",
            "--system-prompt",
            payload["instructions"],
        ]
        if payload.get("model"):
            args += ["--model", payload["model"]]
        process = job.spawn(args, env=env, cwd=work)
        process.stdin.write(json.dumps(payload["messages"]) + "\n")
        process.stdin.close()
        complete = False
        for line in process.stdout:
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if event.get("type") == "stream_event":
                delta = event.get("event", {}).get("delta", {})
                if delta.get("type") == "text_delta":
                    job.event({"type": "delta", "text": delta.get("text", "")})
            if event.get("type") == "result":
                complete = (
                    not event.get("is_error") and event.get("subtype") == "success"
                )
                if complete and not job.text:
                    job.event({"type": "delta", "text": event.get("result", "")})
        if process.wait() or not complete:
            raise RuntimeError(
                "Claude did not complete the response. Check your sign-in and plan limits."
            )

    @staticmethod
    def auth_output(process, job):
        buffer = ""
        while True:
            char = process.stdout.read(1)
            if not char:
                break
            buffer = (buffer + char)[-16000:]
            if char.isspace():
                for candidate in re.findall(r"https://[^\s\x1b]+", buffer):
                    if login_url(candidate):
                        job.event(
                            {
                                "type": "login",
                                "url": candidate,
                                "instruction": "Complete account sign-in in the browser on the Studio host.",
                            }
                        )

    def gemini(self, binary, action, work, directory, env, payload, job):
        # The official CLI's per-user settings explicitly remove all built-in tools.
        # ACP clients also deny any permission or filesystem requests.
        settings = directory / "gemini" / ".gemini"
        settings.mkdir(parents=True, exist_ok=True, mode=0o700)
        (settings / "settings.json").write_text(
            json.dumps(
                {
                    "tools": {"core": []},
                    "security": {"folderTrust": {"enabled": False}},
                    "telemetry": {"enabled": False},
                    "mcpServers": {},
                    "hooks": {},
                    "context": {"fileName": []},
                }
            )
        )
        if action != "login":
            # Expired credentials must fail instead of opening an unsolicited login.
            env["NO_BROWSER"] = "true"
        process = job.spawn([binary, "--acp"], env=env, cwd=work)
        incoming = queue.Queue()

        def reader():
            for line in process.stdout:
                try:
                    incoming.put(json.loads(line))
                except ValueError:
                    pass
            incoming.put(None)

        threading.Thread(target=reader, daemon=True).start()

        def stderr():
            for line in process.stderr:
                if action == "login":
                    for candidate in re.findall(r"https://[^\s\x1b]+", line):
                        if login_url(candidate):
                            job.event(
                                {
                                    "type": "login",
                                    "url": candidate,
                                    "instruction": "Complete Google sign-in in the browser on the Studio host. This CLI uses a local callback.",
                                }
                            )

        threading.Thread(target=stderr, daemon=True).start()
        serial = 0

        def send(value):
            process.stdin.write(json.dumps(value) + "\n")
            process.stdin.flush()

        def rpc(method, params):
            nonlocal serial
            serial += 1
            current = serial
            send({"jsonrpc": "2.0", "id": current, "method": method, "params": params})
            deadline = time.monotonic() + (600 if action == "login" else 180)
            while time.monotonic() < deadline and not job.cancelled:
                try:
                    event = incoming.get(timeout=1)
                except queue.Empty:
                    continue
                if event is None:
                    raise RuntimeError(
                        "Gemini connection closed. Reconnect in Plugins."
                    )
                if event.get("method") == "session/update":
                    update = event.get("params", {}).get("update", {})
                    if (
                        update.get("sessionUpdate") == "agent_message_chunk"
                        and update.get("content", {}).get("type") == "text"
                    ):
                        job.event({"type": "delta", "text": update["content"]["text"]})
                elif event.get("method") and "id" in event:
                    if event["method"] == "session/request_permission":
                        send(
                            {
                                "jsonrpc": "2.0",
                                "id": event["id"],
                                "result": {"outcome": {"outcome": "cancelled"}},
                            }
                        )
                    else:
                        send(
                            {
                                "jsonrpc": "2.0",
                                "id": event["id"],
                                "error": {
                                    "code": -32601,
                                    "message": "Host tools are not available.",
                                },
                            }
                        )
                elif event.get("id") == current:
                    if "error" in event:
                        raise RuntimeError(
                            "Gemini request failed. Check your Google account access and reconnect in Plugins."
                        )
                    return event.get("result", {})
            raise RuntimeError("Gemini request timed out or was cancelled.")

        rpc(
            "initialize",
            {
                "protocolVersion": 1,
                "clientCapabilities": {},
                "clientInfo": {"name": "aether-studio", "version": "0.1.0"},
            },
        )
        rpc("authenticate", {"methodId": "oauth-personal"})
        job.event({"type": "connected", "label": "Google account"})
        if action in ("login", "status"):
            return
        session = rpc("session/new", {"cwd": str(work), "mcpServers": []})
        models = session.get("models", {}).get("availableModels", [])
        job.event(
            {
                "type": "models",
                "models": [{"id": m["modelId"], "name": m["name"]} for m in models]
                or [{"id": "", "name": "Account default"}],
            }
        )
        if action == "models":
            return
        if payload.get("model"):
            rpc(
                "session/set_model",
                {"sessionId": session["sessionId"], "modelId": payload["model"]},
            )
        result = rpc(
            "session/prompt",
            {
                "sessionId": session["sessionId"],
                "prompt": [
                    {
                        "type": "text",
                        "text": payload["instructions"]
                        + "\n\n"
                        + json.dumps(payload["messages"]),
                    }
                ],
            },
        )
        if result.get("stopReason") != "end_turn":
            raise RuntimeError("Gemini did not complete the response.")
