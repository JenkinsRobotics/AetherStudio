"""Host-console installation paths and an OS-owned, single-server lease."""

import json
import os
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path


def platform_paths():
    home = Path.home()
    if sys.platform == "darwin":
        base = home / "Library/Application Support/Aether Studio"
        return base, base / "installation.json"
    if sys.platform == "win32":
        base = (
            Path(os.environ.get("LOCALAPPDATA", home / "AppData/Local"))
            / "Aether Studio"
        )
        return base, base / "installation.json"
    data = (
        Path(os.environ.get("XDG_DATA_HOME", home / ".local/share")) / "aether-studio"
    )
    config = (
        Path(os.environ.get("XDG_CONFIG_HOME", home / ".config"))
        / "aether-studio/installation.json"
    )
    return data, config


def default_directory():
    fallback, config = platform_paths()
    if not config.exists():
        return fallback
    try:
        value = json.loads(config.read_text())
        directory = Path(value["data_directory"])
        if value.get("version") != 1 or not directory.is_absolute():
            raise ValueError()
        return directory
    except (ValueError, KeyError, TypeError) as error:
        raise ValueError(f"Invalid installation configuration: {config}") from error


def local_directory(directory):
    """Reject recognizable sync roots; arbitrary third-party sync roots need operator care."""
    if str(directory).startswith(("\\\\", "//")):
        raise ValueError(
            "Live server data must be on a local disk, not a network share."
        )
    directory = Path(directory).expanduser().resolve()
    for part in directory.parts:
        name = part.casefold()
        if name in {"cloudstorage", "mobile documents", "dropbox"} or name.startswith(
            "onedrive"
        ):
            raise ValueError(
                "Choose a local data folder outside cloud sync. Use the cloud folder as a backup destination instead."
            )
    return directory


def configure_directory(directory):
    directory = local_directory(directory)
    _, config = platform_paths()
    config.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix=".installation-", dir=config.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump({"version": 1, "data_directory": str(directory)}, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, config)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return directory


@contextmanager
def server_lease(directory):
    """Nonblocking process lock. Keep the inode; process exit releases the OS lock."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (directory / ".server.lock").open("a+b") as stream:
        stream.seek(0, os.SEEK_END)
        if not stream.tell():
            stream.write(b"0")
            stream.flush()
        stream.seek(0)
        try:
            if sys.platform == "win32":
                import msvcrt

                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            raise RuntimeError(
                "A Studio server already owns this data directory. Stop it before starting another server."
            ) from error
        try:
            yield
        finally:
            stream.seek(0)
            if sys.platform == "win32":
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
