import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { initialParts } from '../gallery/plasticity-studio/state';
import { featureIndex, modelBodies, modelFeatures, previewParts } from '../gallery/plasticity-studio/feature-model';
import { validateModelParts } from '../gallery/plasticity-studio/model-file';
import { ModelFeatureBrowser } from '../gallery/plasticity-studio/ModelFeatureBrowser';
afterEach(cleanup);

test('native rollback replaces modified solid geometry and removes not-yet-created bodies',()=>{
  const parts=initialParts(), bezel=modelBodies.find(body=>body.id==='bezel')!;
  expect(previewParts(parts,0)).toEqual([]);
  const shell=previewParts(parts,2);
  expect(shell.map(part=>part.id)).toEqual(['shell']);
  const beforeFillet=previewParts(parts,featureIndex.get('bezel-fillet')!);
  expect(beforeFillet.find(part=>part.id==='bezel')?.meshKey).toBe(bezel.tips[1].mesh);
  const afterFillet=previewParts(parts,featureIndex.get('bezel-fillet')!+1);
  expect(afterFillet.find(part=>part.id==='bezel')?.meshKey).toBe(bezel.tips[2].mesh);
  expect(previewParts(parts,modelFeatures.length)).toBe(parts);
});
test('saved studies retain body and native tip identities and reject unknown geometry',()=>{
  const parts=initialParts();
  expect(validateModelParts(JSON.parse(JSON.stringify(parts)))).toEqual(parts);
  expect(()=>validateModelParts([{...parts[0],meshKey:'invented'}])).toThrow('unknown CAD body');
  expect(()=>validateModelParts([{...parts[0],sourceBody:'bezel'}])).toThrow('unknown CAD body');
  expect(new Set(parts.map(part=>part.sourceBody)).size).toBe(39);
});
test('shared tree shows construction operations above individual solids and dispatches native rollback',()=>{
  const select=vi.fn(),rollback=vi.fn();
  render(<ModelFeatureBrowser parts={initialParts()} selected="" onSelect={select} onVisibility={vi.fn()} rollbackIndex={120} onRollback={rollback}/>);
  const features=within(screen.getByRole('tree',{name:'Features'}));
  const parts=within(screen.getByRole('tree',{name:'Parts'}));
  expect(features.getByRole('treeitem',{name:'Default geometry'})).toBeTruthy();
  expect(features.queryByRole('treeitem',{name:'Outer shell'})).toBeNull();
  expect(parts.getByRole('treeitem',{name:'Outer shell'})).toBeTruthy();
  const revolve=features.getByRole('treeitem',{name:'Revolve 1 · Shell section'});
  fireEvent.click(revolve);expect(select).toHaveBeenCalledWith('shell');
  fireEvent.contextMenu(revolve);
  fireEvent.click(screen.getByRole('menuitem',{name:'Roll to here'}));
  expect(rollback).toHaveBeenCalledWith(2);
});
