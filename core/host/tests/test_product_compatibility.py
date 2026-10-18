"""An installed service cannot silently run against another host contract."""

from typing import ClassVar

import pytest

from core.host.compatibility import PLATFORM_API, validate_contract
from core.host.products import Products


@pytest.mark.parametrize(
    "contract",
    [
        None,
        [],
        {},
        {"schema": True},
        {"schema": 2},
        {"schema": 1, "product": "other", "platform_api": 1},
        {"schema": 1, "product": "example", "platform_api": True},
        {"schema": 1, "product": "example", "platform_api": "1"},
        {"schema": 1, "product": "example", "platform_api": 99},
    ],
)
def test_incompatible_or_malformed_contract_rejected(contract):
    with pytest.raises(ValueError):
        validate_contract(contract, "example")


def test_rejection_precedes_service_construction():
    class FutureProduct:
        compatibility: ClassVar[dict] = {
            "schema": 1,
            "product": "example",
            "platform_api": PLATFORM_API + 1,
        }

        def __init__(self):
            pytest.fail("An incompatible service must never start")

    with pytest.raises(ValueError, match="platform API"):
        Products({"example": FutureProduct})


def test_compatible_product_and_existing_optional_products():
    class Compatible:
        app = "example"
        compatibility: ClassVar[dict] = {
            "schema": 1,
            "product": app,
            "platform_api": PLATFORM_API,
        }

    assert (
        Products({"example": Compatible}).get("example").compatibility["platform_api"]
        == PLATFORM_API
    )

    class Legacy:
        app = "legacy"

    assert Products({"legacy": Legacy}).get("legacy").app == "legacy"
