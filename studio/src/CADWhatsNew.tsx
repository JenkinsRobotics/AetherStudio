import { ApplicationUpdates, type ToolIconName } from "@aether/ui";
import { ApplicationHeroArtwork } from "@aether/session/library/ApplicationArtwork";
import "./CADWhatsNew.css";
import { CADUpdateArtwork } from "./CADUpdateArtwork";

/** Curated updates: planned capabilities must never be presented as available. */
const updates: { title: string; detail: string; status: "Available" | "Planned"; icon: ToolIconName; scene: "appearance" | "inspectors" | "tabs" | "materials" | "variants" | "views" }[] = [
  { title: "Make it your own", detail: "Preview body colors, opacity and surface finishes with the new appearance controls. Saved on this device.", status: "Available", icon: "material", scene: "appearance" },
  { title: "A place for every control", detail: "Dedicated panels for appearance, rendering, camera and inspection keep your workspace organized.", status: "Available", icon: "properties", scene: "inspectors" },
  { title: "Your project, in tabs", detail: "Switch between Part Studios and Assemblies from the bottom tab bar. Add another with the + button.", status: "Available", icon: "assembly", scene: "tabs" },
  { title: "Materials that stay with your parts", detail: "Assign and save materials for individual parts and faces, beyond the current viewport preview.", status: "Planned", icon: "material", scene: "materials" },
  { title: "Explore design variations", detail: "Create and edit configurations to manage variations of a design in one document.", status: "Planned", icon: "part", scene: "variants" },
  { title: "Return to the perfect view", detail: "Save named camera views and switch to orthographic projection for precise inspection.", status: "Planned", icon: "view-top", scene: "views" },
];

export function CADWhatsNew() {
 return <ApplicationUpdates name="Aether CAD" description="A space for your next idea. Create a part, build an assembly, or pick up where you left off." artwork={<ApplicationHeroArtwork app="cad"/>} updates={updates.map(update=>({id:update.scene,title:update.title,description:update.detail,status:update.status,color:({appearance:'#ffc3a1',inspectors:'#a8cdb9',tabs:'#b7b9eb',materials:'#ecd094',variants:'#a9d8e6',views:'#e9b7c6'})[update.scene],artwork:<CADUpdateArtwork scene={update.scene} icon={update.icon}/>}))}/>;
}
