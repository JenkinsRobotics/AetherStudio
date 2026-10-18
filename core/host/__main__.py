"""Run, open, or recover the local Aether Studio installation."""

import argparse
import getpass
import webbrowser
import time
import urllib.request
from pathlib import Path

from core.host.server import PACKAGES, serve
from core.host.state import Store
from core.host.installation import default_directory


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=[
            "serve",
            "open",
            "reset-password",
            "restore",
            "configure",
            "certificate",
        ],
        nargs="?",
        default="serve",
    )
    parser.add_argument("--data", type=Path)
    parser.add_argument("--username")
    parser.add_argument("--app", choices=["studio", *PACKAGES], default="studio")
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--hostname")
    parser.add_argument("--ip", action="append", default=[])
    args = parser.parse_args()
    if args.command == "configure" and args.data is None:
        parser.error("configure requires --data")
    args.data = (args.data or default_directory()).expanduser().resolve()
    if args.command == "certificate":
        from core.host.server_certificates import create_certificate

        if not args.hostname:
            parser.error("--hostname is required")
        directory = create_certificate(
            args.data / "certificates", args.hostname, args.ip
        )
        print("Certificate:", directory / "server.pem")
        print("Private key:", directory / "server-key.pem")
        print("Trust this CA on team devices:", directory / "ca.pem")
        print(
            "Keep both private keys on the server. Configure DNS and HTTPS in Administration > Server & network. Server certificate expires in 365 days."
        )
        return
    if args.command == "configure":
        from core.host.installation import configure_directory, server_lease, local_directory

        args.data = local_directory(args.data)
        current = default_directory().resolve()
        with server_lease(current):
            if args.data == current:
                print("Server data:", configure_directory(args.data))
            else:
                with server_lease(args.data):
                    print("Server data:", configure_directory(args.data))
        return
    if args.command == "restore":
        from core.host.backup import restore

        if not args.archive:
            parser.error("--archive is required")
        restore(args.archive, args.data)
        print(
            "Restored. Network settings reset to local-only; sign-in sessions and service tokens revoked."
        )
        return
    if args.command == "serve":
        serve(args.data)
        return
    store = Store(args.data)
    if args.command == "open":
        url = store.settings()["public_url"] + "/"
        if not store.ready():
            url += "#setup=" + store.setup_path.read_text().strip()
        elif args.app != "studio":
            url += args.app + "/"
        for _ in range(30):
            try:
                urllib.request.urlopen(
                    store.settings()["public_url"] + "/api/status", timeout=1
                ).close()
                break
            except Exception:
                time.sleep(0.2)
        webbrowser.open(url)
    else:
        username = args.username or input("Username: ")
        user = store.db.execute(
            "SELECT id FROM users WHERE username=?", (username.lower(),)
        ).fetchone()
        if not user:
            parser.error("User not found")
        password = getpass.getpass("New password (12+ characters): ")
        if password != getpass.getpass("Repeat password: "):
            parser.error("Passwords do not match")
        store.reset_password(user[0], password, False)
        store.audit("local-console", "password_recovery", username)
        print("Password changed and all existing sessions revoked.")


if __name__ == "__main__":
    main()
