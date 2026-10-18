import measure from '@aether/assets/icons/tools/inspect-measure.svg?raw';
import section from '@aether/assets/icons/tools/inspect-section.svg?raw';
import interference from '@aether/assets/icons/tools/inspect-interference.svg?raw';
const icons={measure,section,interference};
/** Original Aether inspection artwork, stored in the shared asset package. */
export function InspectionIcon({kind}:{kind:keyof typeof icons}) {
 return <span aria-hidden="true" data-inspection-icon={kind} style={{display:'inline-flex',width:'100%',height:'100%'}} dangerouslySetInnerHTML={{__html:icons[kind].replace('<svg ','<svg width="100%" height="100%" ')}}/>;
}
