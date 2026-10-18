import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FileCommandBar, FileDetails } from './FileDetails';

afterEach(cleanup);

const ACTIONS = [
  { id: 'open', label: 'Open' }, { id: 'download', label: 'Download' },
  { id: 'share', label: 'Share', disabled: true }, { id: 'rename', label: 'Rename' },
];

test('the command bar shows the first actions and keeps the rest behind one menu', () => {
  const onSelect = vi.fn();
  render(<FileCommandBar items={ACTIONS} inline={2} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(onSelect).toHaveBeenCalledWith('open');
  expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
  expect(onSelect).toHaveBeenLastCalledWith('rename');
});

test('a disabled action stays visible but cannot be chosen', () => {
  const onSelect = vi.fn();
  render(<FileCommandBar items={ACTIONS} onSelect={onSelect} />);
  const share = screen.getByRole('button', { name: 'Share' });
  expect((share as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(share);
  expect(onSelect).not.toHaveBeenCalled();
});

test('the details pane shows a preview, who has access, what happened and the file information', () => {
  const onPreview = vi.fn();
  render(<FileDetails name="Gantry.png" subtitle="PNG image"
    previewURL="/api/drive/download?id=1" previewKind="image" onPreview={onPreview}
    access={[{ id: 'u1', name: 'Jonathan Jenkins', role: 'editor' }]}
    onManageAccess={() => {}}
    activity={[{ id: 7, action: 'rename', author: 'Jonathan Jenkins', created: 1759000000 }]}
    information={[{ label: 'Size', value: '12 KB' }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview Gantry.png' }));
  expect(onPreview).toHaveBeenCalled();
  // The thumbnail is decoration beside the name, so it carries no alt text of its own.
  expect(document.querySelector('img')?.getAttribute('src')).toBe('/api/drive/download?id=1');
  // The avatar carries the person's initials, so the list reads at a glance.
  expect(screen.getByText('JJ')).toBeTruthy();
  expect(screen.getByText('Jonathan Jenkins')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Manage access' })).toBeTruthy();
  // The host's verb reads as words, not as its own identifier.
  expect(screen.getByText('Renamed')).toBeTruthy();
  expect(screen.getByText('12 KB')).toBeTruthy();
});

test('sections the app has no data for are left out', () => {
  render(<FileDetails name="Folder" information={[]} />);
  expect(screen.queryByText('Has access')).toBeNull();
  expect(screen.queryByText('Recent activity')).toBeNull();
  expect(screen.queryByText('File information')).toBeNull();
  // Without a preview the thumbnail is not a button that promises one.
  expect(screen.queryByRole('button')).toBeNull();
});
