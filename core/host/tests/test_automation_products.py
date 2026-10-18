"""Installed product adapters inherit authorization and cannot bypass history."""

from dataclasses import replace

import pytest

from core.host.automation import Automation
from core.host.automation.commands import REVISION, Command, catalog, schema, string
from core.host.tests.test_automation import grant, refused, run
from core.host.tests.test_automation import setup as setup_fixture

setup = setup_fixture

TARGET = {"app": string(40, enum=["map"]), "id": string(128)}


class Product:
    app = "map"
    automation_commands = (
        Command(
            "map.test.inspect",
            "Inspect",
            "Test",
            "inspect",
            schema(TARGET, ["app", "id"]),
            app="map",
        ),
        Command(
            "map.test.edit",
            "Edit",
            "Test",
            "edit",
            schema(
                {**TARGET, "expected_revision": REVISION},
                ["app", "id", "expected_revision"],
            ),
            True,
            "map",
        ),
    )

    def __init__(self):
        self.calls = []

    def automation(self, command, content, arguments):
        self.calls.append(command)
        return {
            "result": {"inspected": True},
            **({"content": b'"changed"'} if command.endswith("edit") else {}),
        }


@pytest.fixture
def product(setup):
    service = Product()
    setup[0].products.services["map"] = service
    return service


def test_old_write_connections_never_gain_content_edit_rights(setup, product):
    token = grant(setup, can_write=True)["token"]
    assert not grant(setup)["connection"]["can_edit_content"]
    commands = setup[2]("/api/automation/commands/list", who=token)["commands"]
    assert "map.test.inspect" in {c["id"] for c in commands}
    assert "map.test.edit" not in {c["id"] for c in commands}
    refused(
        403,
        lambda: run(
            setup, token, "map.test.edit", id=setup[3]["id"], expected_revision=1
        ),
    )
    assert not product.calls


def test_content_edit_history_conflicts_and_read_permission(setup, product):
    token = grant(setup, can_write=True, can_edit_content=True)["token"]
    ident = setup[3]["id"]
    response = run(setup, token, "map.test.edit", id=ident, expected_revision=1)
    assert response["changed"] and response["document"]["revision"] == 2
    history = run(setup, token, "document.history", id=ident)
    assert len(history["revisions"]) == 2
    refused(
        409, lambda: run(setup, token, "map.test.edit", id=ident, expected_revision=1)
    )
    assert product.calls == ["map.test.edit"]
    private_token = grant(setup, who="member", can_write=True, can_edit_content=True)[
        "token"
    ]
    refused(
        404,
        lambda: run(
            setup, private_token, "map.test.edit", id=ident, expected_revision=2
        ),
    )
    assert product.calls == ["map.test.edit"]


def test_foreign_app_hidden_and_denied_before_product_code(setup, product):
    token = grant(setup, apps=["cad"], can_write=True, can_edit_content=True)["token"]
    assert not any(
        c["id"].startswith("map.")
        for c in setup[2]("/api/automation/commands/list", who=token)["commands"]
    )
    refused(403, lambda: run(setup, token, "map.test.inspect", id=setup[3]["id"]))
    assert not product.calls


def test_read_adapter_cannot_write_even_for_edit_grant(setup, product):
    token = grant(setup, can_write=True, can_edit_content=True)["token"]
    product.automation = lambda *args: {"content": b"bad", "result": {}}
    refused(500, lambda: run(setup, token, "map.test.inspect", id=setup[3]["id"]))
    assert (
        setup[0].library.entry(
            setup[0].store.user_for(setup[1]["owner"])["id"], "map", setup[3]["id"]
        )["revision"]
        == 1
    )


def test_existing_database_migration_preserves_old_scope(setup):
    token = grant(setup, can_write=True)["token"]
    setup[0].store.db.execute(
        "ALTER TABLE automation_grants DROP COLUMN can_edit_content"
    )
    setup[0].automation = Automation(setup[0])
    _, connection = setup[0].automation.authorize(token)
    assert connection["can_write"] and not connection["can_edit_content"]


@pytest.mark.parametrize(
    "change",
    [
        {"app": "cad"},
        {"id": "document.edit"},
        {"input_schema": schema(TARGET, ["app", "id"])},
    ],
)
def test_registration_rejects_impersonation_and_unguarded_writes(
    setup, product, change
):
    product.automation_commands = (replace(product.automation_commands[1], **change),)
    with pytest.raises(ValueError):
        catalog(setup[0])


@pytest.mark.parametrize(
    "options",
    [{"can_edit_content": True}, {"can_edit_content": "yes", "can_write": True}],
)
def test_content_grant_requires_explicit_valid_edit_access(setup, options):
    refused(400, lambda: grant(setup, **options))
