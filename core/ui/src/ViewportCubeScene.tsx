import { useEffect, useRef } from "react";
import type { ViewportUpAxis } from "./viewport-cube-geometry";
import type { ViewportOrientation } from "./ViewportNavigationCube";

/** Isolated, on-demand renderer: no second animation loop or product engine. */
export function ViewportCubeScene({orientation,upAxis,highlight,onReady}: {
  orientation: ViewportOrientation; upAxis: ViewportUpAxis; highlight: string | null; onReady: (ready:boolean)=>void;
}) {
  const host=useRef<HTMLDivElement>(null);
  const current=useRef({orientation,highlight}); current.current={orientation,highlight};
  const paint=useRef<(()=>void)|null>(null);
  useEffect(()=>{
    if (!host.current || typeof WebGL2RenderingContext === "undefined") return;
    let stopped=false, dispose: (()=>void)|undefined;
    void import("./viewport-cube-scene").then(module=>{
      if(stopped || !host.current) return;
      try {
        const element=host.current;
        const renderer=module.createCubeRenderer(element.clientWidth || 138);
        let scene=new module.ViewportCubeScene(upAxis,module.readCubeScenePalette(element));
        element.append(renderer.domElement);
        const render=()=>{
          scene.setOrientation(current.current.orientation);
          scene.setHighlight(current.current.highlight);
          renderer.render(scene.scene,scene.camera);
        };
        paint.current=render; render(); onReady(true);
        const observer=new MutationObserver(()=>{
          scene.dispose(); scene=new module.ViewportCubeScene(upAxis,module.readCubeScenePalette(element)); render();
        });
        for (const node of [document.documentElement,document.body]) observer.observe(node,{attributes:true,attributeFilter:["class","style","data-theme"]});
        const lost=(event: Event)=>{event.preventDefault();onReady(false);};
        const restored=()=>{render();onReady(true);};
        renderer.domElement.addEventListener("webglcontextlost",lost);
        renderer.domElement.addEventListener("webglcontextrestored",restored);
        dispose=()=>{
          observer.disconnect(); paint.current=null;
          renderer.domElement.removeEventListener("webglcontextlost",lost);
          renderer.domElement.removeEventListener("webglcontextrestored",restored);
          scene.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
        };
      } catch { onReady(false); }
    }).catch(()=>onReady(false));
    return ()=>{stopped=true; dispose?.(); onReady(false);};
  },[upAxis,onReady]);
  useEffect(()=>{paint.current?.();},[orientation,highlight]);
  return <div ref={host} className="aui-viewport-cube-scene" aria-hidden="true" />;
}
