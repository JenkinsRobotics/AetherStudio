"""Run `python -m core.host.automation mcp` or inspect/call the command API."""

import argparse
import json
import sys

from .client import Client, ClientError
from .mcp import Server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="mode", required=True)
    sub.add_parser("mcp", help="Serve MCP on stdin/stdout")
    sub.add_parser("list", help="List commands available to this connection")
    run = sub.add_parser(
        "run", help="Run a command with a JSON argument object from stdin"
    )
    run.add_argument("command")
    args = parser.parse_args()
    try:
        client = Client.environment()
        if args.mode == "mcp":
            Server(client).serve()
        elif args.mode == "list":
            print(json.dumps(client.call("list", {}), indent=2))
        else:
            data = sys.stdin.buffer.read(1024 * 1024 + 1)
            if len(data) > 1024 * 1024:
                raise ValueError("Arguments exceed the 1 MiB limit.")
            arguments = json.loads(data)
            if not isinstance(arguments, dict):
                raise ValueError("Command arguments must be an object.")
            print(
                json.dumps(
                    client.call("run", {"id": args.command, "arguments": arguments}),
                    indent=2,
                )
            )
    except (ValueError, ClientError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except (KeyboardInterrupt, BrokenPipeError):
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
