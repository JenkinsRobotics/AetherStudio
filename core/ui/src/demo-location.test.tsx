import { expect, test } from "vitest";
import { demoAppsURL, studioAppURL } from "../gallery/demo-location";

test("standalone gallery product links use Studio instead of the UI preview server", () => {
  for (const preview of ["http://127.0.0.1:5215/", "http://localhost:5175/index.html"]) {
    expect(studioAppURL("/cad/gallery/test-window.html", preview)).toBe("http://localhost:8780/cad/gallery/test-window.html");
    expect(studioAppURL("/cad/index.html?demo=harness", preview)).toBe("http://localhost:8780/cad/index.html?demo=harness");
  }
});

test("installed and configured product links preserve the actual Studio origin", () => {
  expect(studioAppURL("/io/", "https://studio.example/ui/?review=demo")).toBe("https://studio.example/io/");
  expect(studioAppURL("/cad/gallery/index.html", "http://localhost:5175/", "https://studio.example")).toBe("https://studio.example/cad/gallery/index.html");
});

test("demo back links return to Apps from root, installed, and standalone HTML pages", () => {
  for (const path of ["/?demo=properties-studio", "/ui/?demo=workspace&workspace=sidebars", "/ui/workbench-window.html"]) {
    const url = new URL(demoAppsURL(`https://studio.example${path}`));
    expect(url.pathname).toBe(path.startsWith("/ui/") ? "/ui/" : "/");
    expect(url.search).toBe("");
    expect(url.hash).toBe("#tab=apps&section=showcase-concept-applications-launchable-demos");
  }
});
