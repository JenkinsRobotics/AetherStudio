import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

type Side = "left" | "right";
type Size = { width?: number; height?: number };
type Sizes = Partial<Record<Side, Size>>;

function read(key?: string):Sizes {
  try {
    const raw = key ? JSON.parse(localStorage.getItem(`${key}.sidebar-sizes`) ?? "{}") : {};
    const result:Sizes = {};
    for (const side of ["left","right"] as const) {
      const size:Size = {};
      for (const dimension of ["width","height"] as const) {
        const value = raw?.[side]?.[dimension];
        if (typeof value === "number" && Number.isFinite(value) && value >= 72) size[dimension]=value;
      }
      result[side]=size;
    }
    return result;
  } catch { return {}; }
}

/** User overrides only; no stored value means the standard automatic sizing. */
export function useSidebarSizes(storageKey?:string, area?:RefObject<HTMLDivElement | null>) {
  const [availableWidth,setAvailableWidth] = useState(1200);
  useLayoutEffect(() => {
    const node = area?.current;
    if(!node) return;
    const measure = () => setAvailableWidth(node.clientWidth || 1200);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => observer?.disconnect();
  },[area]);
  const [sizes,setSizes] = useState<Sizes>(()=>read(storageKey));
  useEffect(()=>{setSizes(read(storageKey));},[storageKey]);
  const update = (side:Side, patch:Size) => setSizes(old=> {
    const next = {...old,[side]:{...old[side],...patch}};
    try { if(storageKey) localStorage.setItem(`${storageKey}.sidebar-sizes`,JSON.stringify(next)); } catch { /* Optional local preference. */ }
    return next;
  });
  return {sizes,update,availableWidth};
}
