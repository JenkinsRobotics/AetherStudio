import { useState, type ReactNode } from "react";
import { OverlayScope } from "../../src/OverlayScope";
import { KitShellProvider, defaultLayout, type LayoutFlags } from "../../src/Kit";
import { UIDevToolRibbon } from "../UIDevToolRibbon";
import { AtlasModelProvider } from "../atlas-demo/AtlasDemoApp";
import { UIDevWorkspace, NativeTemplate } from "./UIDevWorkspace";
import { StateVariant } from "./NativeVariants";
import { KitSpecimens } from "./KitSpecimens";
import { AtlasKitSpecimens } from "./AtlasKit";
import { nativeVariants } from "./NativeVariantCatalog";
import { isModeDuplicate, nativeTemplateSections, nativeVariantSections } from "./inventory";
import { KitGaps, LibraryGaps } from "./LibraryGaps";
import "../AnimationStudioDemo.css";
import "../animation-mockup/animation-mockup.css";
import "./DemoShowcase.css";

/** The original native UI Dev browser, kept whole as its own tool (`?demo=ui-dev`). */
export function NativeLibrary() {
  const [section, setSection] = useState("App Surfaces");
  const [tool, setTool] = useState<string | null>(null);
  return <div className="native-showcase-library">
    <UIDevToolRibbon workspace="ui-dev" activeSection={section} activeTool={tool} onSection={setSection} onCommand={(id) => setTool(id)} />
    <UIDevWorkspace preset="floating" specimen={tool} />
  </div>;
}

/** The demo kits' scope: the kit's structural CSS and portals hang off it; the palette is the page's theme. No box of its own. */
function DemoScope({ children }: { children: ReactNode }) {
  return <OverlayScope data-aether-kit="" className="gallery-imported-scope">{children}</OverlayScope>;
}

function KitScope({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<LayoutFlags>(defaultLayout);
  return <DemoScope><KitShellProvider layout={layout} setLayout={setLayout}>{children}</KitShellProvider></DemoScope>;
}

/**
 * Every imported specimen filed under one section, as flat captioned rows
 * after the section's own widgets: native templates, native state variants,
 * the Aether demo kit, the Atlas demo kit, then library widgets no page showed.
 */
export function ImportedSpecimens({ section }: { section: string }) {
  const templates = Object.keys(nativeTemplateSections).filter((id) => nativeTemplateSections[id] === section && !isModeDuplicate(`template:${id}`));
  const variants = nativeVariants.filter((variant) => nativeVariantSections[variant.id] === section && !isModeDuplicate(`variant:${variant.id}`));
  return <>
    {templates.map((id) => <NativeTemplate key={id} id={id} />)}
    {variants.map((variant) => <StateVariant key={variant.id} id={variant.id} />)}
    <KitScope><KitSpecimens section={section} /><KitGaps section={section} /></KitScope>
    <AtlasModelProvider><DemoScope><AtlasKitSpecimens section={section} /></DemoScope></AtlasModelProvider>
    <LibraryGaps section={section} />
  </>;
}
