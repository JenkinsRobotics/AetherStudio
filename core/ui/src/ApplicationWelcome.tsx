import type { ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { ApplicationUpdates, type ApplicationUpdate } from "./ApplicationUpdates";
export function ApplicationWelcome({name,description,artwork,wideArtwork,badge,updates}: {
 id:string;name:string;description:string;artwork:ReactNode;wideArtwork?:ReactNode;badge?:string;updates?:readonly ApplicationUpdate[];
}) {
 const planned=badge?.toLowerCase().includes('coming soon');
 return <ApplicationUpdates name={name} description={description} artwork={wideArtwork??artwork} updates={updates??[
 {id:'workspace',title:planned?'Your future workspace':'Your workspace',description:planned?'Creation tools and the document library are in development.':'Open existing work or use the app’s starting actions to begin a new document.',status:planned?'Planned':'Available',artwork:<AetherIcon name="folder"/>,color:'#a8cdb9'},
 {id:'appearance',title:'Make it your own',description:'Choose a light or dark interface in Settings to suit your workspace.',status:'Available',artwork:<AetherIcon name="settings"/>,color:'#ecd094'},
 ]}/>;
}
