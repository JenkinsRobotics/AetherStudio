import { expect, test, vi } from "vitest";
import { listDriveFiles, type DriveListQuery, type DriveListing } from "./drive-listing";
import type { DriveFile } from "@aether/session/library/drive-api";

const file = (id: string) => ({ id } as DriveFile);

test("lists personal files against hosts that require a real organization ID", async () => {
  const request = vi.fn(async (query: DriveListQuery): Promise<DriveListing> => {
    if (query.organization === "all") throw new Error("You do not have permission in this organization.");
    return { files: [file(query.organization)], path: [] };
  });
  const result = await listDriveFiles({ organization: "all", view: "recent" }, [{ id: "default" }, { id: "team" }, { id: "team" }], request);
  expect(result.files.map(item => item.id)).toEqual(["default", "team"]);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls.map(([query]) => query.organization)).toEqual(["default", "team"]);
});

test("forwards filters and server-scoped workspace/folder breadcrumbs unchanged", async () => {
  const result: DriveListing = { files: [file("part")], path: [{ id: "folder", name: "Models" }] };
  const request = vi.fn().mockResolvedValue(result);
  const query = { organization: "team", view: "workspace", workspace: "engineering", parent: "folder", query: "wheel", shared_scope: "by" as const };
  expect(await listDriveFiles(query, [{ id: "default" }], request)).toBe(result);
  expect(request).toHaveBeenCalledExactlyOnceWith(query);
});

test("does not invent access when the account has no organizations", async () => {
  const request = vi.fn();
  expect(await listDriveFiles({ organization: "all", view: "personal" }, [], request)).toEqual({ files: [], path: [] });
  expect(request).not.toHaveBeenCalled();
});

test("reports failed scopes instead of showing an incomplete successful result", async () => {
  const request = vi.fn(async (query: DriveListQuery) => {
    if (query.organization === "removed") throw new Error("Membership changed.");
    return { files: [file("part")], path: [] };
  });
  await expect(listDriveFiles({ organization: "all", view: "shared", shared_scope: "with" }, [{ id: "default" }, { id: "removed" }], request)).rejects.toThrow("Membership changed.");
});
