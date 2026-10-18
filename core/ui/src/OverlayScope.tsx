import { createContext, useContext, useState, type HTMLAttributes } from "react";

const OverlayHost = createContext<HTMLElement | null>(null);

/** Keep menus/popovers in a themed subtree when multiple specimen themes coexist.
 * Leave the scope untransformed so viewport-positioned overlays retain their coordinates.
 * Outside a scope, existing consumers still portal to document.body.
 */
export function OverlayScope({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const [host,setHost]=useState<HTMLDivElement|null>(null);
  return <div {...props}><OverlayHost.Provider value={host}>{children}<div ref={setHost} data-aether-overlay-host=""/></OverlayHost.Provider></div>;
}

export function useOverlayHost() { return useContext(OverlayHost); }
