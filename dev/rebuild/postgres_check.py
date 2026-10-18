"""Exercise real PostgreSQL in a private disposable cluster, with no live DB access."""

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def pg_bin():
    explicit = os.environ.get("AETHER_PG_BIN")
    candidates = [Path(explicit)] if explicit else []
    if shutil.which("pg_config"):
        candidates.append(
            Path(subprocess.check_output(["pg_config", "--bindir"], text=True).strip())
        )
    candidates.extend(Path("/opt/homebrew/Cellar/postgresql@17").glob("*/bin"))
    candidates.extend(Path("/usr/lib/postgresql").glob("*/bin"))
    for path in candidates:
        if (path / "initdb").is_file() and (path / "pg_ctl").is_file():
            return path
    raise SystemExit(
        "PostgreSQL binaries required; set AETHER_PG_BIN. No acceptance tests skipped."
    )


def run():
    binaries = pg_bin()
    env = dict(os.environ)
    if sys.platform == "darwin":
        env.setdefault("DEVELOPER_DIR", "/Library/Developer/CommandLineTools")
    if not sys.argv[1:] or sys.argv[1:] in (["--products-only"], ["--documents-only"], ["--cad-settings-only"], ["--frontend-browser"], ["--cad-agents-browser"], ["--agent-access-browser"]):
        from native_product_fixtures import configure

        configure(ROOT, env)
    metadata = json.loads(subprocess.check_output(["cargo", "metadata", "--no-deps", "--format-version", "1", "--locked"], cwd=ROOT, env=env))
    subprocess.run(["cargo", "build", "--locked", "-p", "aether-automation-client"], cwd=ROOT, env=env, check=True)
    env["AETHER_AUTOMATION_BIN"] = str(Path(metadata["target_directory"]) / "debug" / ("aether-agent.exe" if os.name == "nt" else "aether-agent"))
    # Short path also keeps the Unix socket below macOS's path limit.
    with tempfile.TemporaryDirectory(prefix="aether-pg-", dir="/tmp") as temporary:
        root = Path(temporary)
        data = root / "database"
        objects = root / "objects"
        objects.mkdir()
        init = [
            str(binaries / "initdb"),
            "-D",
            str(data),
            "-U",
            "aether_test",
            "--auth=trust",
            "--no-locale",
            "--encoding=UTF8",
        ]
        # Relocatable Homebrew bottles can have an outdated compiled share path.
        share = binaries.parent / "share/postgresql"
        if (share / "postgres.bki").is_file():
            init.extend(["-L", str(share)])
        subprocess.run(init, env=env, check=True, stdout=subprocess.DEVNULL)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        # No TCP listener: local socket is in a private mode-0700 directory.
        # fsync must remain enabled: no performance shortcuts in durability tests.
        options = f"-k {root} -p {port} -h ''"
        started = False
        try:
            subprocess.run(
                [
                    str(binaries / "pg_ctl"),
                    "-D",
                    str(data),
                    "-l",
                    str(root / "postgres.log"),
                    "-o",
                    options,
                    "-w",
                    "start",
                ],
                env=env,
                check=True,
            )
            started = True
            env.update(
                {
                    "AETHER_TEST_PG": f"host={root} port={port} user=aether_test dbname=postgres",
                    "AETHER_TEST_OBJECTS": str(objects),
                    "AETHER_PG_BIN": str(binaries),
                    "AETHER_TEST_PG_ROOT": str(root),
                }
            )
            if not sys.argv[1:] or sys.argv[1:] in (["--animation-only"], ["--services-only"], ["--documents-only"], ["--frontend-browser"], ["--cad-agents-browser"], ["--agent-access-browser"]):
                animation = root / "animation"
                if not env.get("AETHER_TEST_ANIMATION"):
                    subprocess.run([str(ROOT / ".venv/bin/python"), str(ROOT.parent / "Aether-Animation/scripts/build-native-worker.py"), "--output", str(animation), "--python", str(ROOT / ".venv/bin/python")], check=True, env=env)
                    env["AETHER_TEST_ANIMATION"] = str(animation / "native-animation.json")
                env["AETHER_TEST_ANIMATION_ROOT"] = str(ROOT.parent / "Aether-Animation")
            if sys.argv[1:] in (["--frontend-browser"], ["--cad-agents-browser"], ["--agent-access-browser"]):
                distribution = root / "map-distribution"
                if not env.get("AETHER_TEST_MAP_DOWNLOADS"):
                    subprocess.run([str(ROOT / ".venv/bin/python"), str(ROOT.parent / "Aether-Map/scripts/build-device-distribution.py"), "--output", str(distribution)], check=True, env=env)
                    env["AETHER_TEST_MAP_DOWNLOADS"] = str(distribution / "map-downloads.json")
            targets = [
                ["-p", "aether-store", "--features", "hosted,sqlite-reference", "--test", "hosted"],
                ["-p", "aether-identity", "--test", "hosted"],
                ["-p", "aether-server", "--test", "native_http"],
                ["-p", "aether-server", "--test", "native_documents"],
            ]
            filters = []
            release = []
            if sys.argv[1:] == ["--server-ab"]:
                targets = [["-p", "aether-server", "--test", "native_server_ab"]]
                release = ["--release"]
            elif sys.argv[1:] in (["--frontend-browser"], ["--cad-agents-browser"], ["--agent-access-browser"]):
                targets = [["-p", "aether-server", "--test", "native_frontend_browser"]]
                filters = ["real_built_agent_access_browser" if sys.argv[1:] == ["--agent-access-browser"] else "real_built_cad_agents_browser" if sys.argv[1:] == ["--cad-agents-browser"] else "real_built_frontends_browser"]
            elif sys.argv[1:] == ["--identity-only"]:
                targets = [targets[1]]
            elif sys.argv[1:] == ["--http-only"]:
                targets = [["-p", "aether-server", "--test", "native_http"]]
            elif sys.argv[1:] == ["--frontends-only"]:
                targets = targets[-1:]
                filters = ["frontends::"]
            elif sys.argv[1:] == ["--workspace-assets-only"]:
                targets = [["-p", "aether-server", "--test", "native_documents"]]
                filters = ["workspace_assets::"]
            elif sys.argv[1:] == ["--animation-only"]:
                targets = [["-p", "aether-server", "--test", "native_documents"]]
                filters = ["animation::"]
            elif sys.argv[1:] == ["--admin-directory-only"]:
                targets = [["-p", "aether-server", "--test", "native_documents"]]
                filters = ["admin_directory::"]
            elif sys.argv[1:] == ["--admin-apps-only"]:
                targets = targets[-1:]
                filters = ["admin_apps::"]
            elif sys.argv[1:] == ["--map-search-only"]:
                targets = targets[-1:]
                filters = ["map_search::"]
            elif sys.argv[1:] == ["--map-media-only"]:
                targets = targets[-1:]
                filters = ["map_media::"]
            elif sys.argv[1:] in (["--map-devices-only"], ["--map-devices-protocol-only"]):
                targets = targets[-1:]
                filters = ["map_devices::"]
            elif sys.argv[1:] == ["--cad-settings-only"]:
                targets = targets[-1:]
                filters = ["cad_settings_products::"]
            elif sys.argv[1:] == ["--products-only"]:
                targets = targets[-1:]
                filters = ["products::"]
            elif sys.argv[1:] == ["--automation-only"]:
                targets = targets[-1:]
                filters = ["automation::"]
            elif sys.argv[1:] == ["--live-editors-only"]:
                targets = targets[-1:]
                filters = ["live_editors::"]
            elif sys.argv[1:] == ["--agent-access-only"]:
                targets = targets[-1:]
                filters = ["mcp_access::"]
            elif sys.argv[1:] == ["--agents-only"]:
                targets = targets[-1:]
                filters = ["agents::"]
            elif sys.argv[1:] == ["--status-only"]:
                targets = targets[-1:]
                filters = ["status::"]
            elif sys.argv[1:] == ["--uploads-only"]:
                targets = targets[-1:]
                filters = ["uploads::"]
            elif sys.argv[1:] == ["--downloads-only"]:
                targets = targets[-1:]
                filters = ["download::"]
            elif sys.argv[1:] == ["--history-only"]:
                targets = targets[-1:]
                filters = ["library_history::"]
            elif sys.argv[1:] == ["--workspace-preferences-only"]:
                targets = targets[-1:]
                filters = ["workspace_preferences::"]
            elif sys.argv[1:] == ["--library-home-only"]:
                targets = targets[-1:]
                filters = ["library_home::"]
            elif sys.argv[1:] == ["--library-only"]:
                targets = targets[-1:]
                filters = ["library::"]
            elif sys.argv[1:] == ["--membership-only"]:
                targets = targets[-1:]
                filters = ["drive_membership::"]
            elif sys.argv[1:] == ["--drive-copy-only"]:
                targets = targets[-1:]
                filters = ["drive_copy::"]
            elif sys.argv[1:] == ["--drive-links-only"]:
                targets = targets[-1:]
                filters = ["drive_links::"]
            elif sys.argv[1:] == ["--drive-grants-only"]:
                targets = targets[-1:]
                filters = ["drive_grants::"]
            elif sys.argv[1:] == ["--drive-create-only"]:
                targets = targets[-1:]
                filters = ["drive_create::"]
            elif sys.argv[1:] == ["--drive-edits-only"]:
                targets = targets[-1:]
                filters = ["drive_edits::"]
            elif sys.argv[1:] == ["--drive-activity-only"]:
                targets = targets[-1:]
                filters = ["drive_activity::"]
            elif sys.argv[1:] == ["--drive-recycle-only"]:
                targets = targets[-1:]
                filters = ["drive_recycle::"]
            elif sys.argv[1:] == ["--drive-sharing-only"]:
                targets = targets[-1:]
                filters = ["drive_sharing::"]
            elif sys.argv[1:] == ["--file-favorites-only"]:
                targets = targets[-1:]
                filters = ["file_favorites::"]
            elif sys.argv[1:] == ["--drive-items-only"]:
                targets = targets[-1:]
                filters = ["drive_items::"]
            elif sys.argv[1:] == ["--drive-listing-only"]:
                targets = targets[-1:]
                filters = ["drive_listing::"]
            elif sys.argv[1:] == ["--drive-context-only"]:
                targets = targets[-1:]
                filters = ["drive_context::"]
            elif sys.argv[1:] == ["--releases-only"]:
                targets = targets[-1:]
                filters = ["release_lifecycle::"]
            elif sys.argv[1:] == ["--collaboration-only"]:
                targets = targets[-1:]
                filters = ["collaboration::"]
            elif sys.argv[1:] == ["--versions-only"]:
                targets = targets[-1:]
                filters = ["library_versions::"]
            elif sys.argv[1:] == ["--provisioning-only"]:
                targets = targets[-1:]
                filters = ["drive_provisioning::"]
            elif sys.argv[1:] == ["--compare-only"]:
                targets = targets[-1:]
                filters = ["library_compare::"]
            elif sys.argv[1:] == ["--restore-only"]:
                targets = targets[-1:]
                filters = ["library_restore::"]
            elif sys.argv[1:] == ["--workspaces-only"]:
                targets = targets[-1:]
                filters = ["workspace_assets::"]
            elif sys.argv[1:] == ["--company-only"]:
                targets = targets[-1:]
                filters = ["change_stream::company_users_keep_live_subscriptions_while_saving_private_documents"]
                release = ["--release"]
            elif sys.argv[1:] == ["--notifications-only"]:
                targets = targets[-1:]
                filters = ["revision_notifications::"]
                release = ["--release"]
            elif sys.argv[1:] == ["--network-only"]:
                targets = targets[-1:]
                filters = ["network::"]
            elif sys.argv[1:] == ["--backup-only"]:
                targets = targets[-1:]
                filters = ["backup::"]
            elif sys.argv[1:] == ["--services-only"]:
                targets = targets[-1:]
                filters = ["services::"]
            elif sys.argv[1:] == ["--maintenance-only"]:
                targets = targets[-1:]
                filters = ["maintenance::"]
            elif sys.argv[1:] == ["--setup-only"]:
                targets = targets[-1:]
                filters = ["setup::"]
            elif sys.argv[1:] == ["--mail-only"]:
                targets = targets[-1:]
                filters = ["mail::"]
            elif sys.argv[1:] == ["--settings-only"]:
                targets = targets[-1:]
                filters = ["settings::"]
            elif sys.argv[1:] == ["--preferences-only"]:
                targets = targets[-1:]
                filters = ["preferences::"]
            elif sys.argv[1:] == ["--store-only"]:
                targets = targets[:1]
            elif sys.argv[1:] == ["--change-stream-only"]:
                targets = targets[-1:]
                filters = ["change_stream::"]
            elif sys.argv[1:] == ["--library-branches-only"]:
                targets = targets[-1:]
                filters = ["library_branches::"]
            elif sys.argv[1:] == ["--branches-only"]:
                targets = targets[:1]
                filters = ["branches::"]
            elif sys.argv[1:] == ["--documents-only"]:
                targets = targets[-1:]
            elif sys.argv[1:]:
                raise SystemExit("Usage: postgres_check.py [--identity-only|--notifications-only|--company-only|--network-only|--backup-only|--services-only|--maintenance-only|--setup-only|--mail-only|--workspace-assets-only|--animation-only|--admin-directory-only|--admin-apps-only|--map-search-only|--map-media-only|--map-devices-only|--map-devices-protocol-only|--cad-settings-only|--products-only|--automation-only|--live-editors-only|--agent-access-only|--agents-only|--store-only|--change-stream-only|--branches-only|--library-branches-only|--drive-links-only|--server-ab|--documents-only|--status-only|--frontends-only|--frontend-browser|--cad-agents-browser|--uploads-only|--downloads-only|--preferences-only|--settings-only|--history-only|--collaboration-only|--workspace-preferences-only|--library-only|--library-home-only|--drive-context-only|--drive-listing-only|--drive-items-only|--file-favorites-only|--drive-sharing-only|--drive-recycle-only|--drive-activity-only|--drive-edits-only|--drive-create-only|--drive-grants-only|--drive-copy-only|--releases-only|--versions-only|--restore-only|--workspaces-only]")
            maximum_upload = "uploads::upload_512_mib_limit_streams_without_a_whole_file_response_buffer"
            maximum_media = "map_media::upload_512_mib_streams_over_http_and_roundtrips_hash"
            for target in targets:
                document_tests = "native_documents" in target
                # Maximum transfer capacity is qualified on the shipping optimized
                # build, not timed against debug SHA/base64 instrumentation.
                exclusions = ["--skip", maximum_upload, "--skip", maximum_media] if document_tests else []
                if sys.argv[1:] == ["--map-devices-protocol-only"]:
                    exclusions += ["--skip", "map_devices::actual_map_players_panel_pairs_renames_assigns_stops_and_forgets"]
                subprocess.run(
                    ["cargo", "test", "--locked", *release, *target,
                     *filters, "--", "--ignored", "--test-threads=1", "--nocapture", *exclusions],
                    cwd=ROOT, env=env, check=True,
                )
                if document_tests and (not filters or filters == ["uploads::"]):
                    subprocess.run(
                        ["cargo", "test", "--locked", "--release", *target, maximum_upload,
                         "--", "--ignored", "--exact", "--test-threads=1", "--nocapture"],
                        cwd=ROOT, env=env, check=True,
                    )
                if document_tests and (not filters or filters == ["map_media::"]):
                    subprocess.run(
                        ["cargo", "test", "--locked", "--release", *target, maximum_media,
                         "--", "--ignored", "--exact", "--test-threads=1", "--nocapture"],
                        cwd=ROOT, env=env, check=True,
                    )
        finally:
            if started:
                subprocess.run(
                    [
                        str(binaries / "pg_ctl"),
                        "-D",
                        str(data),
                        "-m",
                        "immediate",
                        "-w",
                        "stop",
                    ],
                    env=env,
                    check=True,
                )
    print(
        "Hosted storage acceptance passed; disposable PostgreSQL stopped and removed."
    )


if __name__ == "__main__":
    run()
