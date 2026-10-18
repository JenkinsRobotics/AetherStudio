"""Discoverable platform commands; document meaning remains product-owned."""

import base64
import math
import re
from dataclasses import dataclass

from ..state import Problem


def string(limit=200, **extra):
    return {"type": "string", "minLength": 1, "maxLength": limit, **extra}


def schema(properties, required):
    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


TARGET = {"app": string(40), "id": string(128)}
REVISION = {"type": "integer", "minimum": 1}


@dataclass(frozen=True)
class Command:
    id: str
    title: str
    description: str
    action: str
    input_schema: dict
    writes: bool = False
    app: str | None = None

    def public(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "inputSchema": self.input_schema,
            "writes": self.writes,
            "annotations": {
                "readOnlyHint": not self.writes,
                "destructiveHint": self.writes,
                "idempotentHint": not self.writes,
                "openWorldHint": False,
            },
        }


COMMANDS = (
    Command(
        "document.list",
        "Find documents",
        "List accessible saved files in one application. Searches file names, not live editor state.",
        "list",
        schema(
            {
                "app": string(40),
                "query": {"type": "string", "maxLength": 200},
                "view": string(enum=["personal", "workspace", "recent"]),
                "parent": string(128),
            },
            ["app"],
        ),
    ),
    Command(
        "document.inspect",
        "Inspect saved document",
        "Read saved metadata and up to 64 KiB of UTF-8 content. Binary files return metadata only. Does not inspect unsaved editor state.",
        "read",
        schema({**TARGET, "branch": string(80)}, ["app", "id"]),
    ),
    Command(
        "document.history",
        "Read document history",
        "Read revisions, named versions and branches of an accessible document.",
        "history",
        schema(TARGET, ["app", "id"]),
    ),
    Command(
        "document.rename",
        "Rename document",
        "Rename a document using the revision last read. Creates a recoverable history entry; stale revisions are rejected.",
        "rename",
        schema(
            {**TARGET, "name": string(200), "expected_revision": REVISION},
            ["app", "id", "name", "expected_revision"],
        ),
        True,
    ),
    Command(
        "document.version.create",
        "Create named version",
        "Name the current saved state on a branch. Requires the current branch revision; does not edit document content.",
        "version",
        schema(
            {
                **TARGET,
                "name": string(80),
                "expected_revision": REVISION,
                "branch": string(80),
                "message": {"type": "string", "maxLength": 500},
            },
            ["app", "id", "name", "expected_revision"],
        ),
        True,
    ),
)
BY_ID = {command.id: command for command in COMMANDS}


def validate(data, definition):
    """Validate the deliberately small, flat JSON-schema vocabulary we publish."""
    if not isinstance(data, dict) or set(data) - definition["properties"].keys():
        raise Problem(400, "Unknown command arguments.")
    if set(definition["required"]) - data.keys():
        raise Problem(400, "Missing required command arguments.")
    for key, value in data.items():
        field = definition["properties"][key]
        if field["type"] == "string":
            valid = (
                isinstance(value, str)
                and field.get("minLength", 0) <= len(value) <= field["maxLength"]
            )
        elif field["type"] == "boolean":
            valid = type(value) is bool
        elif field["type"] in ("integer", "number"):
            valid = (
                type(value) in ((int,) if field["type"] == "integer" else (int, float))
                and (type(value) is int or math.isfinite(value))
                and field.get("minimum", -math.inf)
                <= value
                <= field.get("maximum", math.inf)
            )
        else:
            valid = False
        if not valid or ("enum" in field and value not in field["enum"]):
            raise Problem(400, f"Invalid command argument: {key}.")


def execute(host, user, command, arguments):
    if command.app:
        return execute_product(host, user, command, arguments)
    if command.action != "list":
        row = host.library.entry(user["id"], arguments["app"], arguments["id"])
        if row["app"] != arguments["app"]:
            raise Problem(404, "Document not found in this application.")
        if row["kind"] == "folder":
            raise Problem(
                400, "Select a document. Folder edits are not agent commands."
            )
    result = host.library.dispatch(command.action, user, arguments)
    if command.action == "list":
        result["files"] = [
            item for item in result["files"] if item["app"] == arguments["app"]
        ]
    if command.action == "read":
        content = base64.b64decode(result.pop("data_base64"))
        try:
            text = content.decode("utf-8")
            if "\x00" in text:
                raise UnicodeError()
            # Byte boundary decoding avoids sending a split UTF-8 character.
            preview = content[:65536].decode("utf-8", errors="ignore")
            result.update(
                content_kind="text", text=preview, truncated=len(content) > 65536
            )
        except UnicodeError:
            result.update(content_kind="binary", text=None, truncated=False)
        result["saved_state_only"] = True
    return result


def catalog(host):
    """Only installed, operator-trusted products register namespaced commands."""
    commands = list(COMMANDS)
    for app, service in host.products.services.items():
        for command in getattr(service, "automation_commands", ()):
            if (
                not isinstance(command, Command)
                or command.app != app
                or not command.id.startswith(app + ".")
                or re.fullmatch(r"[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+", command.id) is None
                or command.id in {item.id for item in commands}
                or command.input_schema["properties"].get("app", {}).get("enum")
                != [app]
                or not {"app", "id"} <= set(command.input_schema["required"])
                or command.writes
                and "expected_revision" not in command.input_schema["required"]
            ):
                raise ValueError(f"Invalid automation registration for {app}")
            commands.append(command)
    return commands


def execute_product(host, user, command, arguments):
    # Authorization precedes product code, including work on stale revisions.
    row = host.library.entry(
        user["id"], command.app, arguments["id"], write=command.writes
    )
    if row["app"] != command.app or row["kind"] != "file":
        raise Problem(404, "Document not found in this application.")
    if command.writes and arguments["expected_revision"] != row["revision"]:
        raise Problem(409, "This file changed. Read it again before editing.")
    service = host.products.get(command.app)
    response = service.automation(command.id, bytes(row["content"] or b""), arguments)
    metadata = host.library.metadata(row, user["id"])
    content = response.get("content")
    if content is not None:
        if not command.writes or not isinstance(content, bytes):
            raise Problem(500, "Invalid product command response.")
        metadata = host.library.dispatch(
            "save",
            user,
            {
                "app": command.app,
                "id": row["id"],
                "expected_revision": arguments["expected_revision"],
                "data_base64": base64.b64encode(content).decode(),
                "note": f"Agent: {command.id}",
            },
        )
    return {
        **response["result"],
        "document": metadata,
        "saved_state_only": True,
        "changed": content is not None,
    }
