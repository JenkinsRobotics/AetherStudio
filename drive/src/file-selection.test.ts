import {expect,test} from 'vitest';
import {selectFiles} from './file-selection';
const ids=['a','b','c','d'];
test('selects visible ranges forward and backward and preserves additive choices',()=>{
 expect([...selectFiles(ids,new Set(['d']),'a','c',true,false)]).toEqual(['a','b','c']);
 expect([...selectFiles(ids,new Set(),'d','b',true,false)]).toEqual(['b','c','d']);
 expect([...selectFiles(ids,new Set(['d']),'a','b',true,true)]).toEqual(['d','a','b']);
});
test('toggles individual items and safely handles stale filtered anchors',()=>{
 expect([...selectFiles(ids,new Set(['a']),'a','b',false,true)]).toEqual(['a','b']);
 expect([...selectFiles(ids,new Set(['a','b']),'a','b',false,true)]).toEqual(['a']);
 expect([...selectFiles(ids,new Set(['a']),'missing','c',true,false)]).toEqual(['c']);
});


import { selectionForAction } from "./file-selection";
test("single-file commands target the clicked row even inside a multi-selection", () => {
  for (const action of ["rename", "details", "versions", "notes"])
    expect([...selectionForAction(action, "second", new Set(["first", "second"]))]).toEqual(["second"]);
});
test("bulk commands preserve selected rows but exclude an unrelated selection", () => {
  for (const action of ["copy", "move", "trash", "restore", "delete_forever"]) {
    expect([...selectionForAction(action, "second", new Set(["first", "second"]))]).toEqual(["first", "second"]);
    expect([...selectionForAction(action, "third", new Set(["first", "second"]))]).toEqual(["third"]);
  }
});
