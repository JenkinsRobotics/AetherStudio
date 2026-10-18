import {expect, test} from 'vitest';
import {inLibraryWorkspace} from './library-location';
test('workspace projection preserves exact organization and workspace identities', () => {
  const files = [{id:'a',organization:'one',workspace:'team'}, {id:'b',organization:'two',workspace:'team'}, {id:'c',organization:'one',workspace:'other'}, {id:'d',organization:'one',workspace:null}];
  expect(inLibraryWorkspace(files, {organization:'one',workspace:'team'}).map(file => file.id)).toEqual(['a']);
  expect(inLibraryWorkspace(files, null)).toEqual([]);
});
