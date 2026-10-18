import { AvatarStudioSpecimens } from "../avatar-studio/AvatarStudioSpecimens";
import { StudioWidgetSpecimens } from "../material-studio/StudioSpecimens";
import { PlasticitySpecimens } from "../plasticity-studio/PlasticitySpecimens";
import { WheelSpecimens } from "../wheel-studio/WheelSpecimens";
import { WheelReferenceSpecimens } from "../wheel-studio/WheelReferenceSpecimens";
import { SpotlightSpecimens } from "../spotlight-studio/SpotlightSpecimens";
import { STUDIO_SPECIMEN_SECTIONS, STUDIO_SPECIMEN_SOURCES, type StudioSpecimenKind } from "./studio-specimen-sections";
import "./StudioSpecimens.css";

const renderers = { avatar: AvatarStudioSpecimens, material: StudioWidgetSpecimens, model: PlasticitySpecimens,
  wheel: WheelSpecimens, "wheel-reference": WheelReferenceSpecimens, spotlight: SpotlightSpecimens };

export function StudioSpecimens({ section }: { section: string }) {
  const kind = (Object.keys(STUDIO_SPECIMEN_SECTIONS) as StudioSpecimenKind[]).find(kind => STUDIO_SPECIMEN_SECTIONS[kind] === section);
  if (!kind) return null;
  return <>{STUDIO_SPECIMEN_SOURCES.filter(source => (source.kinds as readonly StudioSpecimenKind[]).includes(kind)).map(source => {
    const Specimens = renderers[source.id];
    return <div key={source.id} className="showcase-studio-specimens" data-studio-source={source.id} data-studio-kind={kind}><Specimens kind={kind}/></div>;
  })}</>;
}
