/** The original CAD feature collection page, owned by Aether CAD; shown as a card in Apps. */
import { studioAppURL } from "./demo-location";
export const originalGallery = import.meta.env.VITE_CAD_GALLERY_URL || studioAppURL("/cad/gallery/index.html");
