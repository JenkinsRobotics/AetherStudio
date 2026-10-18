import type { CSSProperties, ReactNode } from "react";
import "./MediaPreview.css";

export interface MediaPreviewProps {
  label: string;
  width: number;
  height: number;
  background?: string;
  backgroundImage?: string;
  backgroundFilter?: string;
  foreground?: { src: string; alt: string; scale?: number; offset?: number; mirrored?: boolean; filter?: string };
  playing?: boolean;
  children?: ReactNode;
}
/** Aspect-correct presentation widget; apps own scene, playback and editing state. */
export function MediaPreview({ label, width, height, background, backgroundImage, backgroundFilter, foreground, playing = false, children }: MediaPreviewProps) {
  return <div className="aui-media-preview" role="group" aria-label={label} data-playing={playing} style={{ aspectRatio: `${Math.max(1,width)} / ${Math.max(1,height)}`, background } as CSSProperties}>
    {backgroundImage && <img className="aui-media-preview__background" src={backgroundImage} alt="" draggable={false} style={{ filter:backgroundFilter }}/>}
    {foreground && <div className="aui-media-preview__subject" style={{ left:`${50 + (foreground.offset ?? 0)}%`, transform:`translateX(-50%) scale(${(foreground.scale ?? 100) / 100})` }}>
      <img src={foreground.src} alt={foreground.alt} draggable={false} style={{ transform:foreground.mirrored ? "scaleX(-1)" : undefined, filter:foreground.filter }}/>
    </div>}
    {children}
  </div>;
}
