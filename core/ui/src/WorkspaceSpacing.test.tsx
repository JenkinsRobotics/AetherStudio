import { expect, test } from "vitest";
import { DEFAULT_WORKSPACE_SPACING, readWorkspaceSpacing } from "./WorkspaceSpacing";

test("absent or invalid stored spacing keeps the Aether UI standard", () => {
  for (const raw of [null, "broken", "null", '{"margin":"bad"}']) {
    expect(readWorkspaceSpacing(raw)).toEqual(DEFAULT_WORKSPACE_SPACING);
  }
});

test("spacing is bounded and partial preferences preserve the other default", () => {
  expect(readWorkspaceSpacing('{"margin":24}')).toEqual({margin:24,clearance:22});
  expect(readWorkspaceSpacing('{"margin":-20,"clearance":999}')).toEqual({margin:0,clearance:64});
});
