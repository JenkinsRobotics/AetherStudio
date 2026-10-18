import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { applicationsFromStatus, useStudioApplications } from "./applications";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("projects host availability without inventing enabled applications", () => {
  const apps = applicationsFromStatus({ apps: [
    { id: "cad", name: "CAD", url: "/cad/", enabled: true, installed: true },
    { id: "hidden", name: "Hidden", url: "/hidden/", enabled: false },
    { id: "planned", name: "Planned", url: "/planned/", installed: false },
    { id: "soon", name: "Soon", url: "/soon/", coming_soon: true },
    null, { id: "incomplete" },
    { id: "unsafe", name: "Unsafe", url: "javascript:alert(1)" },
    { id: "external", name: "External", url: "//example.org" },
    { id: "backslash", name: "Backslash", url: "/\\example.org/" },
    { id: "whitespace", name: "Whitespace", url: "/\n/example.org/" },
  ] });
  expect(apps.map(app => [app.id, app.comingSoon])).toEqual([["cad", false], ["planned", true], ["soon", true]]);
  expect(applicationsFromStatus(null)).toEqual([]);
  expect(applicationsFromStatus({ apps: {} })).toEqual([]);
});

test("loads the per-user catalog with same-origin credentials", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ apps: [{ id: "map", name: "Map", url: "/map/" }] }) });
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(useStudioApplications);
  await waitFor(() => expect(result.current).toHaveLength(1));
  expect(fetch).toHaveBeenCalledWith("/api/status", expect.objectContaining({ credentials: "same-origin", signal: expect.any(AbortSignal) }));
});

test.each(["unauthorized", "offline", "invalid JSON"])("keeps the catalog empty when %s", async failure => {
  const fetch = vi.fn().mockImplementation(async () => {
    if (failure === "offline") throw new Error("offline");
    return { ok: failure !== "unauthorized", json: async () => { throw new Error("invalid JSON"); } };
  });
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(useStudioApplications);
  await act(async () => {});
  expect(result.current).toEqual([]);
});

test("aborts the request when its editor unmounts", async () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  }));
  const { unmount } = renderHook(useStudioApplications);
  unmount();
  expect(signal?.aborted).toBe(true);
});
