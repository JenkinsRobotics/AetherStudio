"""Create an installation-local CA and server certificate for an internal network."""

import ipaddress
import re
import secrets
import shutil
import subprocess
import tempfile
from pathlib import Path


def create_certificate(directory: Path, hostname: str, addresses=()):
    if not re.fullmatch(
        r"(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?", hostname
    ):
        raise ValueError("Enter a DNS hostname, without a scheme, path or port.")
    if any(
        not part or len(part) > 63 or part.startswith("-") or part.endswith("-")
        for part in hostname.split(".")
    ):
        raise ValueError("Invalid DNS hostname.")
    sans = ["DNS:" + hostname]
    sans.extend("IP:" + str(ipaddress.ip_address(value)) for value in addresses)
    executable = shutil.which("openssl")
    if not executable:
        raise ValueError(
            "Install OpenSSL to generate a local certificate, or supply your organization's TLS certificate in Server & network."
        )
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    destination = directory / ("tls-" + secrets.token_hex(6))
    with tempfile.TemporaryDirectory(prefix=".tls-", dir=directory) as temporary:
        work = Path(temporary)
        config = work / "request.cnf"
        config.write_text(
            "[req]\nprompt=no\ndistinguished_name=dn\n[dn]\nCN=Aether Studio local authority\n[ca]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName="
            + ",".join(sans)
            + "\n"
        )

        def run(*args):
            subprocess.run(
                [executable, *args],
                cwd=work,
                check=True,
                capture_output=True,
                timeout=60,
            )

        run(
            "req",
            "-x509",
            "-newkey",
            "rsa:3072",
            "-nodes",
            "-sha256",
            "-days",
            "3650",
            "-config",
            "request.cnf",
            "-extensions",
            "ca",
            "-keyout",
            "ca-key.pem",
            "-out",
            "ca.pem",
        )
        run(
            "req",
            "-new",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-sha256",
            "-config",
            "request.cnf",
            "-subj",
            "/CN=" + hostname,
            "-keyout",
            "server-key.pem",
            "-out",
            "server.csr",
        )
        run(
            "x509",
            "-req",
            "-in",
            "server.csr",
            "-CA",
            "ca.pem",
            "-CAkey",
            "ca-key.pem",
            "-set_serial",
            "0x" + secrets.token_hex(16),
            "-days",
            "365",
            "-sha256",
            "-extfile",
            "request.cnf",
            "-extensions",
            "server",
            "-out",
            "server.pem",
        )
        destination.mkdir(mode=0o700)
        for name in ("ca.pem", "ca-key.pem", "server.pem", "server-key.pem"):
            source = work / name
            source.chmod(0o600)
            source.replace(destination / name)
    return destination
