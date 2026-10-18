import { useState } from 'react';
import { FeatureTree, type FeatureTreeItem, type FeatureTreeRequest } from '../../src';
import { modelFeatures } from './feature-model';
import type { ModelPart } from './state';

export interface ModelFeatureBrowserProps {
  parts: ModelPart[];
  evaluatedParts?: ModelPart[];
  selected: string;
  onSelect: (id: string) => void;
  onVisibility: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  rollbackIndex?: number;
  onRollback?: (index: number) => void;
}
export function ModelFeatureBrowser({parts, evaluatedParts, selected, onSelect, onVisibility, onRename, rollbackIndex, onRollback}: ModelFeatureBrowserProps) {
  const [focus, setFocus] = useState<{id:string;bodyID:string} | null>(null);
  const hasSource = parts.some(part => part.shape === 'cad-body');
  const features:FeatureTreeItem[] = [
    ...(hasSource ? modelFeatures.map(feature => ({id:feature.id,label:feature.label,type:feature.type,kind:'feature' as const})) : []),
    ...parts.filter(() => !hasSource).map(part => ({id:`instance:${part.id}`,label:`${part.shape === 'cad-body' ? 'Copy' : 'Primitive'} · ${part.name}`,type:part.shape === 'cad-body'?'transform':part.shape,kind:'feature' as const})),
  ];
  function request(value:FeatureTreeRequest) {
    if(value.command === 'rollback') onRollback?.(value.index ?? modelFeatures.length);
    else if(value.command === 'visibility') value.ids.forEach(onVisibility);
    else if(value.command === 'rename' && value.name) onRename?.(value.ids[0],value.name);
  }
  return <FeatureTree features={features}
    parts={(evaluatedParts ?? parts).map(part=>({id:part.id,label:part.name,type:'part',kind:'part',hidden:!part.visible}))}
    selectedIDs={new Set([focus?.bodyID === selected ? focus.id : selected])}
    onSelect={ids=>{
      const id=ids[0], feature=modelFeatures.find(item=>item.id === id);
      const bodyID=feature?.bodyID ?? (id.startsWith('instance:')?id.slice(9):id);
      if(parts.some(part=>part.id === bodyID)) {setFocus({id,bodyID});onSelect(bodyID);}
    }}
    availableCommands={['visibility',...(onRename?['rename' as const]:[]),...(onRollback?['rollback' as const]:[])]}
    canCommand={value=>value.command === 'rollback' ? (hasSource && value.index !== undefined && value.index <= modelFeatures.length) || 'Rollback is available for the authored CAD history.' : value.ids.every(id=>parts.some(part=>part.id===id)) || 'Edit construction features in the downloadable Aether CAD document.'}
    onCommand={request} rollbackIndex={hasSource ? rollbackIndex : undefined} ariaLabel="Features" partsLabel="Parts" />;
}
