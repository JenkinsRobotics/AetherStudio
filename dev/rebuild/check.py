"""Fail-fast framework gate; uses disposable servers, never the installation."""

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    env = dict(os.environ)
    # Select the installed command-line SDK without accepting an Xcode license.
    if sys.platform == "darwin" and "DEVELOPER_DIR" not in env:
        sdk = Path("/Library/Developer/CommandLineTools")
        if sdk.is_dir():
            env["DEVELOPER_DIR"] = str(sdk)
    metadata = json.loads(subprocess.check_output(
        ["cargo", "metadata", "--no-deps", "--format-version", "1", "--locked"],
        cwd=ROOT, env=env,
    ))
    env["AETHER_AUTOMATION_BIN"] = str(
        Path(metadata["target_directory"]) / "debug" /
        ("aether-agent.exe" if os.name == "nt" else "aether-agent")
    )
    checks = [
        (ROOT, ["cargo", "fmt", "--all", "--check"]),
        # Check the production feature boundary separately: all-features tests
        # also enable the developer SQLite oracle and can hide missing imports.
        (
            ROOT,
            [
                "cargo",
                "clippy",
                "--locked",
                "-p",
                "aether-store",
                "--",
                "-D",
                "warnings",
            ],
        ),
        (
            ROOT,
            [
                "cargo",
                "clippy",
                "--workspace",
                "--all-targets",
                "--all-features",
                "--locked",
                "--",
                "-D",
                "warnings",
            ],
        ),
        (ROOT, ["cargo", "test", "--workspace", "--all-features", "--locked"]),
        (ROOT, ["node", "--test", "crates/server/providers/providers.test.mjs"]),
        (ROOT, [sys.executable, "dev/rebuild/document_policy_check.py"]),
        (ROOT, [sys.executable, "dev/rebuild/postgres_check.py"]),
        (ROOT, ["cargo", "build", "--locked", "-p", "aether-server", "-p", "aether-automation-client"]),
        (
            ROOT / "core/protocol",
            ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"],
        ),
        (ROOT / "core/protocol", ["npm", "test"]),
        (ROOT / "core/session", ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"]),
        (ROOT / "core/session", ["npm", "run", "typecheck"]),
        (ROOT / "core/session", ["npm", "test"]),
        (ROOT, [sys.executable, "dev/rebuild/file_package_check.py"]),
        (ROOT / "core/files", ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"]),
        (ROOT / "core/files", ["npm", "test"]),
        (ROOT / "core/files", ["node", "tests/browser.mjs"]),
        (ROOT, [sys.executable, "-m", "ruff", "check", "dev/rebuild"]),
        (
            ROOT,
            [
                sys.executable,
                "-m",
                "pytest",
                "dev/rebuild/test_gateway_legacy.py",
                "dev/rebuild/test_legacy_transfer.py",
                "dev/rebuild/test_legacy_map.py",
                "dev/rebuild/test_cutover_source_inventory.py",
                "dev/rebuild/test_merge_demo_sources.py",
                "dev/rebuild/test_native_installation.py",
                "dev/rebuild/test_stage_native_runtime.py",
                "dev/rebuild/test_map_distribution.py",
                "dev/rebuild/test_map_exports.py",
                "dev/rebuild/test_legacy_branches.py",
                "dev/rebuild/test_legacy_workspace_preferences.py",
                "dev/rebuild/test_legacy_file_favorites.py",
                "dev/rebuild/test_legacy_sharing.py", "dev/rebuild/test_legacy_drive_events.py",
                "dev/rebuild/test_editor_transport_legacy.py",
                "core/host/tests/test_automation.py",
                "core/host/tests/test_automation_products.py",
                "core/host/tests/test_automation_native_client.py",
                "core/host/tests/test_accounts.py",
                "core/host/tests/test_drive.py",
                "core/host/tests/test_collaboration.py",
                "-q",
            ],
        ),
    ]
    for cwd, command in checks:
        print(f"Framework gate: {' '.join(command)}", flush=True)
        subprocess.run(command, cwd=cwd, env=env, check=True)
    dependencies = subprocess.check_output(
        [
            "cargo",
            "tree",
            "--locked",
            "-p",
            "aether-store",
            "--edges",
            "normal",
            "--prefix",
            "none",
        ],
        cwd=ROOT,
        env=env,
        text=True,
    )
    if any(
        line.split()[0] in {"rusqlite", "libsqlite3-sys"}
        for line in dependencies.splitlines()
    ):
        raise RuntimeError(
            "Production Studio storage unexpectedly includes the SQLite test fixture"
        )
    local_dependencies = subprocess.check_output(
        [
            "cargo",
            "tree",
            "--locked",
            "-p",
            "aether-local-files",
            "--edges",
            "normal",
            "--prefix",
            "none",
        ],
        cwd=ROOT,
        env=env,
        text=True,
    )
    forbidden = {
        "rusqlite",
        "libsqlite3-sys",
        "tokio-postgres",
        "aether-store",
        "aether-server",
        "aether-identity",
        "reqwest",
        "axum",
    }
    if any(line.split()[0] in forbidden for line in local_dependencies.splitlines()):
        raise RuntimeError(
            "Standalone files unexpectedly depend on server, SQL or network transport"
        )
    print(
        "Incremental framework gate passed (commands, Studio storage and standalone files)."
    )
    print(
        "Full framework release gates remain in dev/rebuild/README.md; no push or cutover."
    )


if __name__ == "__main__":
    main()
