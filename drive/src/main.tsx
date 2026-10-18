import { createRoot } from "react-dom/client";
import "@aether/ui/tokens.css";
import "@aether/ui/widgets.css";
import "@aether/session/library/studio.css";
// Load the library layout after the base Studio shell styles.
import { DriveHome } from "./DriveHome";
createRoot(document.getElementById("root")!).render(<DriveHome/>);
