import { describe, expect, test } from "vitest";
import { adminPages, personalPages, readStudioRoute, studioRouteURL } from "./workspace-route";

describe("Studio navigation", () => {
  test.each(["", "?section=users", "?section=organizations", "?workspace=unknown&section=network"])("keeps ordinary navigation in personal pages: %s", query => {
    expect(readStudioRoute(query)).toEqual({ area: "personal", page: "home" });
  });
  test.each(["?workspace=admin", "?workspace=admin&section=unknown", "?workspace=admin&section=account"])("invalid admin sections fall back to overview: %s", query => {
    expect(readStudioRoute(query)).toEqual({ area: "admin", page: "overview" });
  });
  test("preserves the legacy personal account and plugin links", () => {
    expect(readStudioRoute("?account")).toEqual({ area: "personal", page: "account" });
    expect(readStudioRoute("?plugins")).toEqual({ area: "personal", page: "plugins" });
  });
  test("every supported page survives URL serialization", () => {
    for (const area of ["personal", "admin"] as const) {
      for (const page of area === "admin" ? adminPages : personalPages) {
        const route = { area, page };
        expect(readStudioRoute(new URL(studioRouteURL(route), "https://studio.test").search)).toEqual(route);
      }
    }
  });
  test("produces stable default entry points", () => {
    expect(studioRouteURL({ area: "personal", page: "home" })).toBe("/");
    expect(studioRouteURL({ area: "admin", page: "overview" })).toBe("/?workspace=admin");
  });
});
