import json
import os
import plistlib
import shutil
import socket
import ssl
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import company_network as network


class CompanyNetworkTests(unittest.TestCase):
    def test_lan_discovery_refuses_other_networks_and_injected_names(self):
        for value in ["127.0.0.1", "169.254.1.2", "8.8.8.8", "0.0.0.0", "::1", "bad"]:
            self.assertIsNone(network.private_ipv4(value))
        for value in ["10.25.0.243", "172.16.1.2", "192.168.10.3"]:
            self.assertEqual(network.private_ipv4(value), value)
        for name in ["https://aether.local", "-aether.local", "aether.local/", "a.local\n", "a.example.com"]:
            with self.assertRaises(ValueError):
                network.validate(name, "en0", 8780)
        config = {"hostname": "aether-studio.local", "interface": "en0", "port": 8780}
        self.assertEqual(network.command(config, "10.25.0.243")[-3:],
                         ["aether-studio.local", "10.25.0.243", "path=/"])
        with self.assertRaises(ValueError):
            network.command(config, "8.8.8.8")

    def test_stage_retains_app_data_and_produces_only_public_client_material(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            os.chmod(root, 0o700)
            source = root / "existing.json"
            environment = {
                "AETHER_NATIVE_PG": "host=/private/socket dbname=company user=operator",
                "AETHER_NATIVE_TENANT": "test",
                "AETHER_NATIVE_OBJECTS": "/private/existing-objects",
                "AETHER_NATIVE_FRONTENDS": "/private/existing-frontends.json",
                "AETHER_NATIVE_LISTEN": "127.0.0.1:8780",
                "AETHER_NATIVE_PUBLIC_ORIGIN": "http://localhost:8780",
            }
            source.write_text(json.dumps({"schema": 1, "environment": environment}))
            os.chmod(source, 0o600)
            marker = root / "marker.json"
            marker.write_text(json.dumps({"config": str(source), "binary": "/same/binary"}))
            destination = root / "candidate"
            with patch.object(network, "interface_address", return_value="10.25.0.243"), \
                 patch.object(socket, "getaddrinfo", side_effect=socket.gaierror):
                report = network.stage(marker, destination, "aether-studio.local", "en0", 8780,
                                       shutil.which("openssl"))
            self.assertFalse(report["activated"])
            changed = json.loads((destination / "installation.json").read_text())["environment"]
            for name in ["PG", "TENANT", "OBJECTS", "FRONTENDS"]:
                self.assertEqual(changed["AETHER_NATIVE_" + name], environment["AETHER_NATIVE_" + name])
            self.assertEqual(changed["AETHER_NATIVE_PUBLIC_ORIGIN"], "https://aether-studio.local:8780")
            self.assertEqual(json.loads(source.read_text())["environment"], environment)
            for name in ["installation.json", "tls/aether-studio.key"]:
                self.assertEqual((destination / name).stat().st_mode & 0o077, 0)
            public_files = sorted(p.name for p in (destination / "workstation").iterdir())
            self.assertEqual(public_files, ["Aether-Studio.crt", "CONNECT.txt"])
            cert = destination / "workstation/Aether-Studio.crt"
            text = subprocess.check_output([shutil.which("openssl"), "x509", "-in", str(cert),
                                            "-text", "-noout"], text=True)
            self.assertIn("CA:FALSE", text)
            self.assertIn("DNS:aether-studio.local", text)
            ssl.create_default_context(cafile=str(cert))
            spec = plistlib.loads((destination / "discovery.plist").read_bytes())
            self.assertTrue(spec["RunAtLoad"])
            self.assertNotIn("8780", spec["ProgramArguments"])

    def test_existing_name_is_not_hijacked(self):
        with (
            patch.object(network, "interface_address", return_value="10.25.0.243"),
            patch.object(socket, "getaddrinfo", return_value=[object()]),
            self.assertRaisesRegex(ValueError, "already resolves"),
        ):
            network.stage(Path("unused"), Path("unused"), "aether-studio.local", "en0", 8780,
                          shutil.which("openssl"))

    def test_activation_refuses_untrusted_certificate_without_changing_service(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            environment = {"AETHER_NATIVE_PG": "same database", "AETHER_NATIVE_TLS_CERT": "/public/cert"}
            source = root / "source.json"
            source.write_text(json.dumps({"environment": environment}))
            marker = root / "marker.json"
            marker.write_text(json.dumps({"config": str(source)}))
            (root / "previous-marker.json").write_bytes(marker.read_bytes())
            (root / "installation.json").write_bytes(source.read_bytes())
            (root / "discovery.json").write_text(json.dumps({"hostname": "aether-studio.local"}))
            with (
                patch.object(subprocess, "run", return_value=subprocess.CompletedProcess([], 1)) as run,
                self.assertRaisesRegex(ValueError, "Approve the server certificate"),
            ):
                network.activate(marker, root)
            self.assertEqual(run.call_count, 1)
            self.assertEqual(run.call_args.args[0][:2], ["/usr/bin/security", "verify-cert"])
            self.assertEqual(json.loads(marker.read_text()), {"config": str(source)})
            (root / "previous-marker.json").write_text("{}")
            with (
                patch.object(subprocess, "run") as run,
                self.assertRaisesRegex(ValueError, "Another installation changed"),
            ):
                network.activate(marker, root)
            run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
