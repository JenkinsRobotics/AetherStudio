import {expect, test} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {DriveWorkspaces} from './DriveWorkspaces';

test('directory excludes personal files and groups same-named workspaces by organization', () => {
  const html = renderToStaticMarkup(<DriveWorkspaces organizations={[{id:'a',name:'Alpha'},{id:'b',name:'Beta'}]}
    workspaces={[{id:'1',organization:'a',name:'Design',role:'owner'}, {id:'2',organization:'b',name:'Design',role:'viewer'}]}
    query="" onOpen={() => {}} onFavorite={async () => {}} />);
  expect(html).not.toContain('My files');
  expect(html).toContain('aria-label="Filter workspaces"');
  expect(html).toContain('aui-file-type-filters');
  expect(html).toContain('aria-label="Alpha workspaces"');
  expect(html).toContain('aria-label="Beta workspaces"');
  expect(html.match(/Open workspace Design/g)).toHaveLength(2);
  expect(html).toContain('Can view');
});
