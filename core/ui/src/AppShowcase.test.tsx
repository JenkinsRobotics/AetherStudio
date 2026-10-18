import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CADFeatureEditors } from '../gallery/CADFeatureEditors';
import { ConceptAppDirectory, conceptApps } from '../gallery/ConceptAppDirectory';
import { SHOWCASE_TABS, sectionTab } from '../gallery/showcase';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); });
test('apps contain only a standalone directory; app widgets live in Widgets and all launchers live in Apps', () => {
 const tab = SHOWCASE_TABS.find(tab => tab.id === 'apps')!;
 expect(tab.label).toBe('Apps');
 expect(tab.sections).toEqual(['Concept applications — launchable demos', 'Workspaces — launchable concepts']);
 expect(tab.groups[0].reviewTogether).toBe(true);
 expect(sectionTab('Electronics + instruments')).toBe('widgets');
 expect(sectionTab('CAD feature editors')).toBe('widgets');
 expect(sectionTab('Workspaces — launchable concepts')).toBe('apps');
 expect(SHOWCASE_TABS.find(tab => tab.id === 'widgets')!.groups.find(group => group.id === 'cad')!.sections[0]).toBe('CAD feature editors');
});
test('all local demo cards use the shared resizable workspace window launcher', () => {
 const popup = { focus: vi.fn(), opener: window, closed: false };
 const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
 render(<ConceptAppDirectory />);
 expect(screen.queryByRole('link')).toBeNull();
 expect(screen.getAllByRole('button')).toHaveLength(conceptApps.length - 1);
 const hosted = ['cad-test-window', 'cad-features', 'cad-harness', 'io', 'ui'];
 for (const app of conceptApps.filter(app => !hosted.includes(app.id))) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp('^' + app.name + ' ') }));
  const call = open.mock.calls.at(-1)!;
  const url = new URL(call[0] as string);
  expect(url.searchParams.get('presentation')).toBe('window');
  expect(call[1]).toBe(`aether-ui-demo-${app.id}`);
  expect(call[2]).toContain('popup=yes');
  expect(call[2]).toContain('resizable=yes');
 }
 expect(open).toHaveBeenCalledTimes(conceptApps.filter(app => !hosted.includes(app.id)).length);
});
test('the CAD feature editors (Widgets › Aether CAD) are bare feature windows, all nine, with no frame or link', () => {
 const { container } = render(<CADFeatureEditors />);
 expect(container.querySelectorAll('.aui-feature-window')).toHaveLength(9);
 expect(container.querySelector('iframe')).toBeNull();
 expect(screen.queryByRole('link')).toBeNull();
});
test('Animation category uses the same window action for its three retained demos', () => {
 const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn(), opener: window } as unknown as Window);
 render(<ConceptAppDirectory ids={['animation','animation-mockup','atlas-demo']} title="Animation demos" />);
 for (const card of screen.getAllByRole('button')) fireEvent.click(card);
 expect(open.mock.calls.map(call => new URL(call[0] as string).searchParams.get('demo'))).toEqual(['animation-studio','animation-mockup','atlas-demo']);
 expect(screen.queryByRole('link')).toBeNull();
});

test('Studio address cards copy the intended app URL without sending a rejected cross-origin launch', async () => {
 const writeText = vi.fn().mockResolvedValue(undefined);
 vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { clipboard: { writeText } }));
 render(<ConceptAppDirectory />);
 fireEvent.click(screen.getByRole('button', { name: /^CAD test app / }));
 expect((screen.getByRole('textbox', { name: 'Studio app address' }) as HTMLInputElement).value).toBe('http://localhost:8780/cad/gallery/test-window.html');
 fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
 await waitFor(() => expect(writeText).toHaveBeenCalledWith('http://localhost:8780/cad/gallery/test-window.html'));
 expect(screen.getByRole('button', {name:'Address copied'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: 'Done' }));
 expect(screen.queryByRole('dialog')).toBeNull();
});

test('installed Aether UI opens hosted apps in workspace windows from the same launch cards', () => {
 window.history.replaceState({}, '', '/ui/');
 const open = vi.spyOn(window, 'open').mockReturnValue({focus: vi.fn(), opener: window} as unknown as Window);
 render(<ConceptAppDirectory />);
 for (const name of ['CAD test app', 'CAD feature collection', 'CAD harness demo', 'Aether IO']) {
  fireEvent.click(screen.getByRole('button', {name: new RegExp('^' + name + (name === 'Aether IO' ? ' The installed' : ' '))}));
 }
 expect(open).toHaveBeenCalledTimes(4);
 expect(open.mock.calls.every(call => call[2]?.includes('popup=yes'))).toBe(true);
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.queryByRole('link')).toBeNull();
});
