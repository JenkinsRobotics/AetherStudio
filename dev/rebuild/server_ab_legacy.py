"""Run the preserved original host against disposable data for server_ab.mjs.

This deliberately imports the specified original checkout, never the replacement
host. No production database, app workers, or hardware connections are used.
"""

import json
import os
import signal
import sys
import tempfile
from http.server import ThreadingHTTPServer
from pathlib import Path

original = Path(os.environ["AETHER_AB_ORIGINAL"]).resolve(strict=True)
sys.path.insert(0, str(original))
from core.host import server as original_server

assert Path(original_server.__file__).resolve().is_relative_to(original)
with tempfile.TemporaryDirectory(prefix="aether-original-ab-") as temporary:
    root = Path(temporary)
    dist = root / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("Disposable A/B fixture")
    host = original_server.StudioHost(
        root / "data", packages={"map": ("Map", "Fixture", dist)}
    )
    host.store.create_user("editor", "ab-fixture-password-2026", "admin", False)
    token = host.store.sign_in("editor", "ab-fixture-password-2026", "127.0.0.1")
    # Optional second comparison only. Never changes the original installation.
    # Keep the as-shipped NORMAL run as the primary A baseline.
    if os.environ.get("AETHER_AB_DURABLE") == "1":
        host.store.db.execute("PRAGMA synchronous=FULL")
        host.store.db.execute("PRAGMA fullfsync=ON")
    storage = {key: host.store.db.execute(f"PRAGMA {key}").fetchone()[0]
               for key in ("journal_mode", "synchronous", "fullfsync")}

    class QuietHandler(original_server.make_handler(host)):
        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    server.daemon_threads = True
    origin = f"http://127.0.0.1:{server.server_port}"
    host.running_settings["public_url"] = origin
    def shutdown(_signal, _frame):
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, shutdown)
    print(json.dumps({"origin": origin, "cookie": f"aether_session={token}", "storage": storage}), flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        host.agents.close()
        host.store.db.close()
