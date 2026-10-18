import { useEffect } from "react";
import { readHeaderPins, setHeaderPins } from "../src/header-controls";

export const CAD_HEADER_PINS = ["theme", "notifications", "comments", "apps", "share"];
const CAD_PINS_REVISION = "aether-cad-header-compact-pins-v1";

/** All CAD previews share saved choices; introduce the requested pins only once. */
export function useCADHeaderPins(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    try {
      if (localStorage.getItem(CAD_PINS_REVISION)) return;
      const pins = readHeaderPins("cad", CAD_HEADER_PINS);
      setHeaderPins("cad", [...pins, ...["apps", "share"].filter(pin => !pins.includes(pin))]);
      localStorage.setItem(CAD_PINS_REVISION, "1");
    } catch { /* Shared controls retain their defaults when storage is unavailable. */ }
  }, [enabled]);
}
