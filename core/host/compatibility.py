"""Versioned host boundary; product document semantics stay with products."""

import json
from importlib.resources import files

PLATFORM_API = 1


def validate_contract(value, app):
    if (
        not isinstance(value, dict)
        or type(value.get("schema")) is not int
        or value["schema"] != 1
    ):
        raise ValueError(f"{app}: unsupported product compatibility manifest")
    if value.get("product") != app:
        raise ValueError(f"{app}: compatibility manifest identity mismatch")
    api = value.get("platform_api")
    if type(api) is not int or api != PLATFORM_API:
        raise ValueError(
            f"{app}: requires platform API {api!r}; installed host provides {PLATFORM_API}"
        )
    return value


def packaged_contract(package, app):
    """Read an operator-installed resource, never a request-provided path."""
    return validate_contract(
        json.loads(files(package).joinpath("compatibility.json").read_text()), app
    )
