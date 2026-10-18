import {expect, test} from 'vitest';
import {organizationChildren} from './workspace-root';
const workspaces = [
  {id:'root',organization:'org',name:'Jenkins Robotics',role:'owner',is_default:true},
  {id:'eng',organization:'org',name:'Engineering',role:'owner'},
  {id:'same',organization:'org',name:'Jenkins Robotics',role:'owner'},
  {id:'other',organization:'elsewhere',name:'Admin',role:'owner'},
];
test('organization root shows only its accessible team workspaces, including same-name spaces',()=>{
  expect(organizationChildren(workspaces,'root',null,'').map(w=>w.id)).toEqual(['eng','same']);
  expect(organizationChildren(workspaces,'same',null,'')).toEqual([]);
  expect(organizationChildren(workspaces,'root','folder','')).toEqual([]);
  expect(organizationChildren(workspaces,'root',null,'search')).toEqual([]);
  expect(organizationChildren(workspaces,'missing',null,'')).toEqual([]);
});
