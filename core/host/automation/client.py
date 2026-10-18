"""Bounded loopback-only transport for the development agent adapter."""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


class ClientError(Exception):
    def __init__(self, message, status=503):
        super().__init__(message)
        self.status = status


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


class Client:
    def __init__(self, url, token):
        parsed = urlsplit(url)
        # Literal loopback avoids DNS resolution/rebinding. Remote hosting needs a
        # separate trusted-server enrollment flow and is not enabled by this client.
        if (
            parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or parsed.path not in ("", "/")
            or parsed.scheme != "http"
            or parsed.hostname != "127.0.0.1"
            or not parsed.port
        ):
            raise ValueError(
                "Use the local Aether server: http://127.0.0.1:PORT. Remote connections are not enabled."
            )
        if not token.startswith("aether_agent_") or any(c.isspace() for c in token):
            raise ValueError(
                "Create an agent connection in Studio and set AETHER_AUTOMATION_TOKEN."
            )
        self.url, self.token = url.rstrip("/"), token
        self.opener = build_opener(ProxyHandler({}), NoRedirect())

    @classmethod
    def environment(cls):
        return cls(
            os.environ.get("AETHER_SERVER_URL", "http://127.0.0.1:8781"),
            os.environ.get("AETHER_AUTOMATION_TOKEN", ""),
        )

    def call(self, action, data):
        if action not in ("list", "run"):
            raise ValueError("Unknown command transport action.")
        request = Request(
            self.url + "/api/automation/commands/" + action,
            data=json.dumps(data, allow_nan=False).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + self.token,
            },
        )
        try:
            with self.opener.open(request, timeout=30) as response:
                payload = response.read(8 * 1024 * 1024 + 1)
                if len(payload) > 8 * 1024 * 1024:
                    raise ClientError(
                        "The result is too large. Narrow the document query."
                    )
                return json.loads(payload)
        except HTTPError as error:
            try:
                message = json.loads(error.read(16384)).get(
                    "error", "Aether refused the command."
                )
            except (ValueError, AttributeError):
                message = "Aether refused the command."
            raise ClientError(str(message), error.code) from None
        except (URLError, TimeoutError, OSError, ValueError):
            raise ClientError(
                "Cannot reach local Aether Studio. Check the server address and connection."
            ) from None
