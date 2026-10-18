/** Flat caption and content. Specimen layout never supplies a window/card frame. */
import { useEffect, useState, type ReactNode } from "react";

export type SpecimenSource = "kit" | "atlas";

function sourceLabel(source: SpecimenSource, group: string): string {
  if (source === "atlas") return "atlas-demo";
  if (group.startsWith("Rex")) return "animation-studio · Rex build";
  if (group.startsWith("CodexUI")) return "animation-studio · CodexUI";
  return "animation-mockup";
}

export function Specimen({ source, group, label, wide, children }: { source: SpecimenSource; group: string; label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className="gallery-variant" data-imported-specimen={label} data-imported-group={group} data-imported-source={source} data-wide={wide || undefined}>
      <small>{label} · {sourceLabel(source, group)}</small>
      <div className="gallery-specimen-panel">{children}</div>
    </div>
  );
}

/** The gallery's resolved appearance (the header toggle writes `data-aether-theme` on <html>). */
export function usePageAppearance(): "light" | "dark" {
  const read = () => (typeof document !== "undefined" && document.documentElement.dataset.aetherTheme === "light" ? "light" : "dark");
  const [appearance, setAppearance] = useState<"light" | "dark">(read);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setAppearance(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-aether-theme"] });
    setAppearance(read());
    return () => observer.disconnect();
  }, []);
  return appearance;
}
