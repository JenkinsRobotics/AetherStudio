import { AetherIcon } from "./AetherIcon";
/** Selection artwork composes the shared pointer with a region outline. */
export function SelectionIcon({mode="window"}:{mode?:"window"|"crossing"|"directional"}) {
 return <span className={`aui-selection-icon aui-selection-icon--${mode}`} aria-hidden="true"><span className="aui-selection-icon-region"/><AetherIcon name="node-select"/></span>;
}
