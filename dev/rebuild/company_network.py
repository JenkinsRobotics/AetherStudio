#!/usr/bin/env python3
"""Stage private macOS LAN HTTPS configuration and advertise its named service.

This operator utility neither switches the server nor changes certificate trust.
The existing Rust server remains the only application listener.
"""
import argparse
import hashlib
import ipaddress
import json
import os
import plistlib
import re
import shutil
import signal
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PRIVATE_NETWORKS = tuple(ipaddress.ip_network(n) for n in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
))


def validate(hostname, interface, port):
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.local", hostname):
        raise ValueError("Use one lowercase .local hostname, without a URL or path.")
    if not re.fullmatch(r"en[0-9]{1,3}", interface):
        raise ValueError("Select a macOS Ethernet/Wi-Fi interface such as en0.")
    if not 1024 <= port <= 65535:
        raise ValueError("Use a port from 1024 to 65535.")


def private_ipv4(value):
    try:
        address = ipaddress.ip_address(value.strip())
    except ValueError:
        return None
    return str(address) if address.version == 4 and any(
        address in network for network in PRIVATE_NETWORKS
    ) else None


def interface_address(interface):
    result = subprocess.run(
        ["/usr/sbin/ipconfig", "getifaddr", interface],
        capture_output=True, text=True, timeout=5, check=False,
    )
    return private_ipv4(result.stdout) if result.returncode == 0 else None


def command(config, address):
    validate(config["hostname"], config["interface"], config["port"])
    if private_ipv4(address) != address:
        raise ValueError("Bonjour advertisements require a private LAN IPv4 address.")
    return ["/usr/bin/dns-sd", "-P", "Aether Studio", "_https._tcp", "local.",
            str(config["port"]), config["hostname"], address, "path=/"]


def write(path, data, mode=0o600):
    with os.fdopen(os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, mode), "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())


def json_write(path, value):
    write(path, (json.dumps(value, indent=2) + "\n").encode())


def stage(marker, destination, hostname, interface, port, openssl):
    validate(hostname, interface, port)
    if sys.platform != "darwin":
        raise ValueError("This discovery adapter is for macOS; other hosts use company DNS.")
    address = interface_address(interface)
    if not address:
        raise ValueError("The selected interface has no private company-network IPv4 address.")
    # An existing .local owner must be investigated before staging a duplicate.
    try:
        socket.getaddrinfo(hostname, port)
    except socket.gaierror:
        pass
    else:
        raise ValueError("This hostname already resolves; choose or inspect its owner first.")
    current = json.loads(marker.read_text())
    source = Path(current["config"])
    for private in (source, source.parent):
        if private.is_symlink() or private.stat().st_mode & 0o077:
            raise ValueError("Source installation configuration must be private and not a symlink.")
    config = json.loads(source.read_text())
    if config.get("schema") != 1:
        raise ValueError("Unsupported installation configuration.")
    destination.mkdir(mode=0o700)
    tls = destination / "tls"
    tls.mkdir(mode=0o700)
    certificate, key = tls / "aether-studio.crt", tls / "aether-studio.key"
    previous_umask = os.umask(0o077)
    try:
        subprocess.run([
            openssl, "req", "-new", "-x509", "-newkey", "ec", "-pkeyopt",
            "ec_paramgen_curve:P-256", "-noenc", "-sha256", "-days", "365",
            "-keyout", str(key), "-out", str(certificate), "-subj", f"/CN={hostname}",
            "-addext", f"subjectAltName=DNS:{hostname}",
            "-addext", "basicConstraints=critical,CA:FALSE",
            "-addext", "keyUsage=critical,digitalSignature",
            "-addext", "extendedKeyUsage=serverAuth",
        ], capture_output=True, check=True, timeout=30)
    finally:
        os.umask(previous_umask)
    origin = f"https://{hostname}:{port}"
    config["environment"].update({
        "AETHER_NATIVE_LISTEN": f"0.0.0.0:{port}",
        "AETHER_NATIVE_PUBLIC_ORIGIN": origin,
        "AETHER_NATIVE_TLS_CERT": str(certificate),
        "AETHER_NATIVE_TLS_KEY": str(key),
        "AETHER_NATIVE_TLS_ROOT": str(tls),
    })
    json_write(destination / "installation.json", config)
    json_write(destination / "previous-marker.json", current)
    discovery = {"hostname": hostname, "interface": interface, "port": port}
    json_write(destination / "discovery.json", discovery)
    helper = destination / "company_network.py"
    write(helper, Path(__file__).read_bytes())
    label = "com.aether.studio.native.discovery"
    plist = {
        "Label": label,
        "ProgramArguments": [str(Path(sys.executable).resolve()), str(helper),
                             "announce", "--config", str(destination / "discovery.json")],
        "RunAtLoad": True, "KeepAlive": True, "ThrottleInterval": 10,
        "ProcessType": "Background",
        "StandardOutPath": str(destination / "discovery.log"),
        "StandardErrorPath": str(destination / "discovery.log"),
    }
    write(destination / "discovery.plist", plistlib.dumps(plist))
    write(destination / "discovery.log", b"")
    public = destination / "workstation"
    public.mkdir(mode=0o700)
    write(public / "Aether-Studio.crt", certificate.read_bytes(), 0o644)
    fingerprint = subprocess.run(
        [openssl, "x509", "-in", str(certificate), "-noout", "-fingerprint", "-sha256", "-enddate"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    (public / "CONNECT.txt").write_text(
        f"Aether Studio company network\n{origin}/\nMCP: {origin}/mcp\n\n"
        "Install only this public server certificate on each workstation. Never share the key.\n"
        "macOS: open Aether-Studio.crt in Keychain Access, then trust it for SSL.\n"
        "Or, from this folder, run (macOS may request authentication):\n"
        f"security add-trusted-cert -r trustRoot -p ssl -s {hostname} "
        "-k ~/Library/Keychains/login.keychain-db Aether-Studio.crt\n\n"
        "Sign in with your existing Studio account at the new address.\n"
        "The .local name works on the same multicast-capable LAN; routed/VLAN networks\n"
        "need administrator-managed DNS/discovery. No Internet forwarding was configured.\n"
        "This certificate expires after one year; renewal requires distributing the new\n"
        "public certificate, or adopting the company's managed certificate authority.\n\n"
        f"Verify this fingerprint before trusting:\n{fingerprint}\n"
    )
    return {"origin": origin, "interface": interface, "address": address,
            "certificate": str(certificate), "fingerprint": fingerprint,
            "workstation_bundle": str(public), "staged": True, "activated": False}


def stop_child(child):
    if child and child.poll() is None:
        child.terminate()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait(timeout=5)


def announce(config):
    validate(config["hostname"], config["interface"], config["port"])
    running = True
    child, previous = None, None

    def stop(_signum, _frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        while running:
            try:
                address = interface_address(config["interface"])
            except (OSError, subprocess.TimeoutExpired):
                address = None
            if address != previous or (child and child.poll() is not None):
                stop_child(child)
                child = subprocess.Popen(command(config, address)) if address else None
                previous = address
                print(f"Discovery address: {address or 'offline'}", flush=True)
            time.sleep(2)
    finally:
        stop_child(child)


def activate(marker, candidate):
    """Switch only after local certificate trust, preserving the current generation."""
    current = json.loads(marker.read_text())
    if current != json.loads((candidate / "previous-marker.json").read_text()):
        raise ValueError("Another installation changed. Rebase the candidate before activation.")
    config_path = candidate / "installation.json"
    config = json.loads(config_path.read_text())["environment"]
    previous = json.loads(Path(current["config"]).read_text())["environment"]
    permitted = {"LISTEN", "PUBLIC_ORIGIN", "TLS_CERT", "TLS_KEY", "TLS_ROOT"}
    for key in set(config) | set(previous):
        if key.removeprefix("AETHER_NATIVE_") not in permitted and config.get(key) != previous.get(key):
            raise ValueError("Network activation must preserve all app, identity and data settings.")
    discovery = json.loads((candidate / "discovery.json").read_text())
    trust = subprocess.run(["/usr/bin/security", "verify-cert", "-c", config["AETHER_NATIVE_TLS_CERT"],
                            "-p", "ssl", "-s", discovery["hostname"]],
                           capture_output=True, timeout=15, check=False)
    if trust.returncode:
        raise ValueError("Approve the server certificate in macOS before switching the running site.")
    binary = Path(current["binary"])
    digest = hashlib.sha256(binary.read_bytes()).hexdigest()
    if digest != current["binary_sha256"]:
        raise ValueError("The active native executable changed.")
    agents = Path.home() / "Library/LaunchAgents"
    server_path = agents / "com.aether.studio.native.server.plist"
    discovery_path = agents / "com.aether.studio.native.discovery.plist"
    old_plist = server_path.read_bytes()
    spec = plistlib.loads(old_plist)
    if spec["ProgramArguments"] != [str(binary), "serve", "--config", current["config"]]:
        raise ValueError("The service definition no longer matches the active installation.")
    domain = f"gui/{os.getuid()}"
    job = domain + "/" + spec["Label"]

    def run(args):
        result = subprocess.run(list(map(str, args)), capture_output=True, text=True, timeout=60, check=False)
        if result.returncode:
            raise RuntimeError(f"Operator command failed: {args[0]}")
        return result.stdout

    def replace(path, data):
        temporary = path.with_name(path.name + ".network-next")
        write(temporary, data)
        os.replace(temporary, path)

    def bootstrap(path):
        for _ in range(40):
            result = subprocess.run(["launchctl", "bootstrap", domain, str(path)], capture_output=True,
                                    timeout=10, check=False)
            if result.returncode == 0:
                return
            time.sleep(0.25)
        raise RuntimeError("Service registration did not settle.")

    def get(url, context):
        with urllib.request.urlopen(url, context=context, timeout=5) as response:
            return json.load(response)

    before = json.loads(run([binary, "verify-store", "--config", current["config"]]))
    if discovery_path.exists():
        raise ValueError("An existing discovery job must be inspected before activation.")
    write(candidate / "previous-server.plist", old_plist)
    write(discovery_path, (candidate / "discovery.plist").read_bytes())
    stopped = False
    try:
        bootstrap(discovery_path)
        expected = interface_address(discovery["interface"])
        for attempt in range(10):
            try:
                resolved = {value[4][0] for value in socket.getaddrinfo(discovery["hostname"], discovery["port"])}
                if resolved != {expected}:
                    raise ValueError("The network name does not resolve exclusively to this server.")
                break
            except socket.gaierror:
                if attempt == 9:
                    raise RuntimeError("The company network name did not resolve.") from None
                time.sleep(1)
        if json.loads(marker.read_text()) != current:
            raise ValueError("Concurrent installation promotion; the server was not switched.")
        status = run(["launchctl", "print", job])
        match = re.search(r"\n\s*pid = (\d+)", status)
        pid = int(match.group(1)) if match else None
        run(["launchctl", "bootout", job])
        stopped = True
        for attempt in range(180):
            try:
                if pid:
                    os.kill(pid, 0)
                else:
                    break
            except ProcessLookupError:
                break
            if attempt == 179:
                raise RuntimeError("The previous server did not drain.")
            time.sleep(0.25)
        spec["ProgramArguments"][-1] = str(config_path)
        replace(server_path, plistlib.dumps(spec))
        bootstrap(server_path)
        origin = config["AETHER_NATIVE_PUBLIC_ORIGIN"]
        context = ssl.create_default_context(cafile=config["AETHER_NATIVE_TLS_CERT"])
        for attempt in range(60):
            try:
                readiness = get(origin + "/readyz", context)
                if not readiness.get("identity_ready") or not readiness.get("documents_ready"):
                    raise ValueError("The native stores are not ready.")
                break
            except (OSError, urllib.error.URLError):
                if attempt == 59:
                    raise RuntimeError("The HTTPS server did not become ready.") from None
                time.sleep(0.5)
        metadata = get(origin + "/.well-known/oauth-protected-resource/mcp", context)
        if metadata["resource"] != origin + "/mcp":
            raise ValueError("MCP discovery still points to the old site.")
        after = json.loads(run([binary, "verify-store", "--config", config_path]))
        for name in ("documents", "revisions"):
            if after[name] < before[name]:
                raise ValueError("Native integrity totals unexpectedly decreased.")
        if json.loads(marker.read_text()) != current:
            raise ValueError("Another installation promoted during this change.")
        report = {"origin": origin, "mcp": metadata["resource"], "native_binary_sha256": digest,
                  "before": before, "after": after, "database_restarted": False,
                  "apps_and_workers_preserved": True, "second_workstation_verified": False}
        json_write(candidate / "activation-report.json", report)
        promoted = {**current, "origin": origin, "generation": str(candidate), "config": str(config_path)}
        replace(marker, (json.dumps(promoted, indent=2) + "\n").encode())
        return report
    except BaseException:
        if json.loads(marker.read_text()) != current:
            raise RuntimeError("A concurrent deployment now owns the service; preserve it for review.") from None
        if stopped:
            subprocess.run(["launchctl", "bootout", job], capture_output=True, timeout=45, check=False)
            replace(server_path, old_plist)
            bootstrap(server_path)
        subprocess.run(["launchctl", "bootout", domain + "/com.aether.studio.native.discovery"],
                       capture_output=True, timeout=30, check=False)
        discovery_path.unlink(missing_ok=True)
        (candidate / "activation-report.json").unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    plan = sub.add_parser("stage")
    plan.add_argument("--marker", type=Path, required=True)
    plan.add_argument("--destination", type=Path, required=True)
    plan.add_argument("--hostname", default="aether-studio.local")
    plan.add_argument("--interface", default="en0")
    plan.add_argument("--port", type=int, default=8780)
    plan.add_argument("--openssl", default=shutil.which("openssl"))
    daemon = sub.add_parser("announce")
    daemon.add_argument("--config", type=Path, required=True)
    switch = sub.add_parser("activate")
    switch.add_argument("--marker", type=Path, required=True)
    switch.add_argument("--candidate", type=Path, required=True)
    args = parser.parse_args()
    if args.action == "stage":
        print(json.dumps(stage(args.marker.resolve(), args.destination.absolute(),
                               args.hostname, args.interface, args.port, args.openssl), indent=2))
    elif args.action == "announce":
        announce(json.loads(args.config.read_text()))
    else:
        print(json.dumps(activate(args.marker.resolve(), args.candidate.resolve()), indent=2))


if __name__ == "__main__":
    main()
