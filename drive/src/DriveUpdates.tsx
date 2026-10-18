import {AetherIcon, type ApplicationUpdate} from '@aether/ui';
import './DriveUpdates.css';
function FileScene({mode}:{mode:'folders'|'history'|'sync'}) {
 return <div className={`drive-feature-scene drive-feature-scene--${mode}`} aria-hidden="true">
  <div className="drive-feature-sheet"><AetherIcon name={mode==='history'?'history':mode==='sync'?'refresh':'folder'}/><i/><i/><i/></div>
  <div className="drive-feature-chip"><AetherIcon name={mode==='folders'?'file-part':mode==='history'?'check':'document'}/></div>
  <div className="drive-feature-line"/>
 </div>;
}
export const DRIVE_UPDATES:ApplicationUpdate[]=[
 {id:'locations',title:'One home for every file',description:'Browse personal files and organization workspaces together. Open each document in its own Aether app.',status:'Available',color:'#a8cbbd',artwork:<FileScene mode="folders"/>},
 {id:'history',title:'Keep a record of your work',description:'Inspect saved revisions and file details on your connected Studio server.',status:'Available',color:'#b7c8e6',artwork:<FileScene mode="history"/>},
 {id:'collaboration',title:'Create together, in real time',description:'See who’s working with you and follow live changes as your team edits supported documents together.',status:'Planned',color:'#c7b9e7',artwork:<FutureScene mode="collaboration"/>},
 {id:'desktop',title:'Your files, wherever you work',description:'Keep selected folders on your computer and sync changes when you reconnect. Open online-only files on demand.',status:'Planned',color:'#edc29e',artwork:<FileScene mode="sync"/>},
 {id:'search',title:'Find more than a filename',description:'Search inside supported documents and use richer filters to find the right file across your organization.',status:'Planned',color:'#f1d78d',artwork:<FutureScene mode="search"/>},
 {id:'protection',title:'A safety net for your Drive',description:'Recover a workspace to an earlier point after accidental changes, with guided bulk recovery.',status:'Planned',color:'#a9d2d5',artwork:<FutureScene mode="protection"/>},
];
function FutureScene({mode}:{mode:'collaboration'|'search'|'protection'}) {
 const icon = mode === 'collaboration' ? 'group' : mode === 'search' ? 'search' : 'shield';
 return <div className={`drive-feature-scene drive-future-scene drive-future-scene--${mode}`} aria-hidden="true">
  <div className="drive-feature-sheet"><AetherIcon name={icon}/><i/><i/><i/></div>
  {mode === 'collaboration' ? <div className="drive-feature-people"><span>A</span><span>B</span><span>C</span></div>
   : <div className="drive-feature-chip"><AetherIcon name={mode === 'search' ? 'document' : 'history'}/></div>}
 </div>;
}
