import url from '@aether/assets/models/scifirobot/scifirobot.glb?url';
/** Original display artwork; seven named mesh groups, meters, Y up. */
export const modelStudioSample = { id: 'scifirobot', name: 'Scifirobot', url, filename: 'scifirobot.glb', format: 'glb', units: 'meters', kind: 'mesh-study' } as const;

import cadURL from "@aether/assets/models/scifirobot/parametric/Scifirobot.acpart?url";
import stepURL from "@aether/assets/models/scifirobot/parametric/Scifirobot.step?url";
/** Native feature-authored reconstruction, generated and verified by Aether CAD. */
export const modelStudioFeatureSample = {id:"scifirobot-parametric",name:"Scifirobot",url:cadURL,stepURL,filename:"Scifirobot.acpart",format:"acpart",units:"millimeters",kind:"feature-model"} as const;
