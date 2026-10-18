import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { VersionControlDemo } from "../gallery/demo-review/VersionControlDemo";
afterEach(cleanup);
async function open() { const view = render(<VersionControlDemo/>); await screen.findByRole('button', { name: 'Select Main' }); return view; }
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const input = (name: string, value: string) => fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });

test('single top creation control, selected preview and version/category/branch filters', async () => {
  const { container } = await open(); click('Select Main');
  expect(screen.getAllByRole('button', { name:'Create version' })).toHaveLength(1);
  expect(screen.getByRole('button', { name:'Restore Main' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name:'Merge branches' }).hasAttribute('disabled')).toBe(true);
  expect(container.querySelector('[data-icon-missing]')).toBeNull();
  if (!screen.queryByRole('radio', { name:'Releases' })) click('Version filters');
  fireEvent.click(screen.getByRole('radio', { name:'Releases' }));
  expect(screen.getByRole('button', { name:'Select Production release' })).toBeTruthy();
  expect(screen.queryByRole('button', { name:'Select Main' })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name:'Branches' }));
  expect(screen.getByRole('button', { name:'Select Experiment' })).toBeTruthy();
  click('Choose version branch'); fireEvent.click(screen.getByRole('menuitem', { name:'Main' }));
  expect(screen.queryByRole('button', { name:'Select Experiment' })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name:'Version sort' }), { target:{ value:'oldest' } });
  expect(screen.getByRole('button', { name:'Select Main' })).toBeTruthy();
});

test('local creation supports versions, branches and releases and prevents duplicate names', async () => {
  await open(); click('Create version'); input('Version name','Fit check'); input('Version description','Adjusted mounting clearance'); click('Create');
  expect(screen.getByRole('button', { name:'Select Fit check' }).getAttribute('aria-expanded')).toBe('true');
  click('Create version'); input('Version name','Fit check');
  expect(screen.getByRole('alert').textContent).toContain('already used'); click('Cancel');
  click('Create version options'); fireEvent.click(screen.getByRole('menuitem', { name:'Create branch' })); input('Version name','Mount study'); click('Create');
  if (!screen.queryByRole('radio', { name:'Branches' })) click('Version filters');
  fireEvent.click(screen.getByRole('radio', { name:'Branches' })); expect(screen.getByRole('button', { name:'Select Mount study' })).toBeTruthy();
  click('Create version options'); fireEvent.click(screen.getByRole('menuitem', { name:'Create release' })); input('Version name','Approved fit'); click('Create');
  if (!screen.queryByRole('radio', { name:'Releases' })) click('Version filters');
  fireEvent.click(screen.getByRole('radio', { name:'Releases' })); expect(screen.getByRole('button', { name:'Select Approved fit' })).toBeTruthy();
});

test('changes and comparison are scoped to the selected entry and local records reset on remount', async () => {
  const view = await open(); click('Select Main'); click('Show changes (3)');
  expect(screen.getByLabelText('Changes for Main').textContent).toContain('Reduced wall thickness');
  click('Compare Main');
  const dialog = within(screen.getByRole('dialog', { name:'Compare versions' }));
  fireEvent.change(dialog.getByRole('combobox', { name:'Compare with version' }), { target:{ value:'version:Production release' } });
  expect(dialog.getByText('Approved document')).toBeTruthy(); click('Done');
  click('Create version'); input('Version name','Only in this window'); click('Create'); view.unmount();
  await open(); expect(screen.queryByRole('button', { name:'Select Only in this window' })).toBeNull();
});


test('real ancestry, branch lanes and merge links survive selection, filters and reversed order', async () => {
  const { container } = await open();
  const graph = screen.getByRole('img', { name:'Branch and merge graph' });
  const edge = (from: string, to: string) => graph.querySelector(`path[data-from="${from}"][data-to="${to}"]`);
  expect(edge('workspace:Main', 'version:Merge checkpoint')).toBeTruthy();
  expect(edge('version:Merge checkpoint', 'version:Alternative')?.getAttribute('data-merge')).toBe('true');
  expect(edge('version:Alternative', 'version:Production release')?.getAttribute('data-merge')).toBe('false');
  expect(graph.querySelector('[data-node="workspace:Main"]')?.getAttribute('cx')).not.toBe(graph.querySelector('[data-node="workspace:Experiment"]')?.getAttribute('cx'));
  expect(container.querySelectorAll('.aui-vc-details')).toHaveLength(0);
  const legend = screen.getByRole('list', { name:'Version types' });
  expect(within(legend).getAllByRole('listitem')).toHaveLength(9);
  expect(legend.textContent).toContain('Merge'); expect(legend.textContent).toContain('Release');
  click('Select Main'); expect(container.querySelectorAll('.aui-vc-details')).toHaveLength(1);
  click('Select Main'); expect(container.querySelectorAll('.aui-vc-details')).toHaveLength(0);
  expect(screen.getByRole('button', { name:'Select Main' }).getAttribute('aria-pressed')).toBe('false');
  if (!screen.queryByRole('radio', { name:'Releases' })) click('Version filters');
  fireEvent.click(screen.getByRole('radio', { name:'Releases' }));
  expect(edge('version:Review candidate', 'version:Production release')).toBeTruthy();
  expect(graph.querySelectorAll('circle')).toHaveLength(2);
  fireEvent.click(screen.getByRole('radio', { name:'All versions' }));
  if (!screen.queryByRole('combobox', { name:'Version sort' })) click('Version filters');
  fireEvent.change(screen.getByRole('combobox', { name:'Version sort' }), { target:{ value:'oldest' } });
  expect(edge('version:Merge checkpoint', 'version:Alternative')?.getAttribute('data-merge')).toBe('true');
  fireEvent.change(screen.getByRole('searchbox', { name:'Search versions' }), { target:{ value:'Main' } });
  expect(graph.querySelector('[data-node="workspace:Experiment"]')).toBeNull();
  expect(edge('version:Merge checkpoint', 'version:Production release')).toBeTruthy();
});

test('creating after deselection starts from Main; a new branch retains its parent on a separate lane', async () => {
  const { container } = await open();
  click('Create branch'); input('Version name','New branch'); click('Create');
  const row = screen.getByRole('button', { name:'Select New branch' }).closest('[data-entry-id]')!;
  const id = row.getAttribute('data-entry-id');
  expect(container.querySelector(`path[data-from="${id}"][data-to="workspace:Main"]`)).toBeTruthy();
  expect(container.querySelector(`circle[data-node="${id}"]`)?.getAttribute('data-lane')).toBe('2');
  click('Create version'); input('Version name','Branch checkpoint'); click('Create');
  const checkpoint = screen.getByRole('button', { name:'Select Branch checkpoint' }).closest('[data-entry-id]')!.getAttribute('data-entry-id');
  expect(container.querySelector(`path[data-from="${checkpoint}"][data-to="${id}"]`)).toBeTruthy();
  expect(container.querySelector(`circle[data-node="${checkpoint}"]`)?.getAttribute('data-lane')).toBe('2');
});


test('a focused branch retains its fork ancestry, compact selection and full graph navigation', async () => {
  const { container } = render(<VersionControlDemo activeBranch="Experiment"/>);
  await screen.findByRole('button', { name:'Select Experiment' });
  expect(screen.getByRole('heading', { name:'Versions' })).toBeTruthy();
  const graph = screen.getByRole('img', { name:'Branch version timeline' });
  expect(graph.querySelector('path[data-from="version:Alternative"][data-to="version:Production release"]')).toBeTruthy();
  expect(screen.queryByRole('button', { name:'Select Merge checkpoint' })).toBeNull();
  click('Select Alternative'); expect(container.querySelectorAll('.aui-vc-details')).toHaveLength(0);
  expect(screen.getByRole('button', { name:'Select Alternative' }).getAttribute('aria-pressed')).toBe('true');
  click('Select Alternative'); expect(screen.getByRole('button', { name:'Select Alternative' }).getAttribute('aria-pressed')).toBe('false');
  click('Version actions: Alternative'); fireEvent.click(screen.getByRole('menuitem', { name:'Show changes' }));
  expect(screen.getByLabelText('Changes for Alternative')).toBeTruthy();
  click('Choose version branch'); fireEvent.click(screen.getByRole('menuitem', { name:'All branches · Full graph' }));
  expect(screen.getByRole('img', { name:'Branch and merge graph' })).toBeTruthy();
  expect(screen.getByRole('button', { name:'Select Main' })).toBeTruthy();
});

test('new versions use the viewed branch and retain their captured image with a missing-image fallback', async () => {
  const image = 'data:image/png;base64,c25hcHNob3Q=';
  render(<VersionControlDemo captureSnapshot={() => image}/>);
  await screen.findByRole('button', { name:'Select Main' });
  click('Choose version branch'); fireEvent.click(screen.getByRole('menuitem', { name:'Experiment' }));
  click('Create version options'); fireEvent.click(screen.getByRole('menuitem', { name:'Create version' }));
  input('Version name','Captured branch'); click('Create');
  const row = screen.getByRole('button', { name:'Select Captured branch' }).closest('[data-entry-id]')!;
  const graph = screen.getByRole('img', { name:'Branch version timeline' });
  expect(graph.querySelector(`path[data-from="${row.getAttribute('data-entry-id')}"][data-to="workspace:Experiment"]`)).toBeTruthy();
  const snapshot = screen.getByRole('img', { name:'Snapshot of Captured branch' });
  expect(snapshot.getAttribute('src')).toBe(image);
  click('Select Captured branch');
  expect(screen.getByRole('img', { name:'Snapshot of Captured branch' }).getAttribute('src')).toBe(image);
  fireEvent.error(snapshot);
  expect(within(row as HTMLElement).getByLabelText('No saved snapshot')).toBeTruthy();
  expect(screen.queryByRole('button', { name:'Close version control' })).toBeNull();
});
