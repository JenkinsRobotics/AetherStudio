import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AetherIcon } from './AetherIcon';

/** One bounded viewport for every ribbon density, with explicit overflow controls. */
export function ToolTrayScroll({ children, label, role }: { children: ReactNode; label: string; role: 'group' | 'tabpanel' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ overflow: false, start: true, end: true });
  useEffect(() => {
    const el = ref.current!;
    const measure = () => setEdges(previous => {
      const next = { overflow: el.scrollWidth > el.clientWidth + 1, start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 };
      return Object.keys(next).every(key => next[key as keyof typeof next] === previous[key as keyof typeof next]) ? previous : next;
    });
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || el.scrollWidth <= el.clientWidth) return;
      const delta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      el.scrollLeft += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1);
      event.preventDefault();
      event.stopPropagation();
      measure();
    };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('scroll', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    measure();
    return () => { observer?.disconnect(); el.removeEventListener('wheel', wheel); el.removeEventListener('scroll', measure); };
  }, [children]);
  const move = (direction: number) => { const el = ref.current; if (el) { el.scrollLeft += direction * Math.max(120, el.clientWidth * .75); el.dispatchEvent(new Event('scroll')); } };
  return <div className="aui-workspace-ribbon-tools" role={role} aria-label={label}>
    {edges.overflow && <button type="button" className="aui-tool-tray-scroll" aria-label="Scroll tools left" title="Left" disabled={edges.start} onClick={() => move(-1)}><AetherIcon name="chevron-left" /></button>}
    <div ref={ref} className="aui-tool-tray-viewport" tabIndex={0} aria-label={`${label} scroll area`} onKeyDown={event => {
      if (event.target !== event.currentTarget || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const el = event.currentTarget;
      if (event.key === 'Home' || event.key === 'End') { el.scrollLeft = event.key === 'Home' ? 0 : el.scrollWidth; el.dispatchEvent(new Event('scroll')); }
      else move(event.key === 'ArrowLeft' ? -1 : 1);
    }}>{children}</div>
    {edges.overflow && <button type="button" className="aui-tool-tray-scroll" aria-label="Scroll tools right" title="Right" disabled={edges.end} onClick={() => move(1)}><AetherIcon name="chevron-right" /></button>}
  </div>;
}
