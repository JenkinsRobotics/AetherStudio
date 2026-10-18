// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { commentImage, commentScreenshot } from "./comment-images";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("rejects unsupported attachments before decoding", async () => {
  await expect(commentImage(new File(["<svg/>"], "drawing.svg", {type:"image/svg+xml"}))).rejects.toThrow("PNG, JPEG or WebP");
});

it("releases the selected screen if playback fails", async () => {
  const stop = vi.fn();
  const getDisplayMedia = vi.fn().mockResolvedValue({getTracks:()=>[{stop}]});
  vi.stubGlobal("navigator", {mediaDevices:{getDisplayMedia}});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("Playback failed"));
  await expect(commentScreenshot()).rejects.toThrow("Playback failed");
  expect(stop).toHaveBeenCalledOnce();
  expect(getDisplayMedia).toHaveBeenCalledWith({video:true,audio:false});
});
