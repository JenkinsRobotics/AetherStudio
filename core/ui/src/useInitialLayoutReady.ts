import { useLayoutEffect, useState } from "react";

/** Measurements during mount are initialization, not an animated user resize.
 * Allow the initial layout/ResizeObserver cycle to settle before enabling motion. */
export function useInitialLayoutReady() {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    if (typeof requestAnimationFrame === "undefined") { setReady(true); return; }
    let next = 0;
    const first = requestAnimationFrame(() => {
      next = requestAnimationFrame(() => setReady(true));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(next); };
  }, []);
  return ready;
}
