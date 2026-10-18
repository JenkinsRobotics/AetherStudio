"""Permission-filtered ZIP snapshots; compression runs outside the host lock."""

from pathlib import Path
import tempfile
import zipfile


def snapshot(drive, uid, folder):
    entries = drive.descendants(folder)
    by_id = {entry["id"]: entry for entry in entries}
    output = []
    for entry in entries:
        if not drive.access.role(entry, uid):
            continue
        names, cursor = [entry["name"]], entry
        while cursor["id"] != folder["id"]:
            cursor = by_id[cursor["parent"]]
            names.insert(0, cursor["name"])
        name = "/".join(names)
        output.append(
            (name, entry["kind"], drive.storage.blob(entry), entry["content"] or b"")
        )
    return output


def archive(entries):
    with tempfile.NamedTemporaryFile(
        prefix="aether-drive-", suffix=".zip", delete=False
    ) as temporary:
        target = Path(temporary.name)
    try:
        with zipfile.ZipFile(
            target, "w", zipfile.ZIP_DEFLATED, allowZip64=True
        ) as output:
            for name, kind, blob, content in entries:
                if kind == "folder":
                    output.writestr(name + "/", "")
                elif blob:
                    output.write(blob, name)
                else:
                    output.writestr(name, content)
        return target
    except Exception:
        target.unlink(missing_ok=True)
        raise
