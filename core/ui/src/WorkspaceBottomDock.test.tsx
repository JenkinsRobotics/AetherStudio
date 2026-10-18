import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { WorkspaceBottomDock } from './WorkspaceBottomDock';

test('independent dock panels retain their pressed state and collapse only when all close', () => {
  function Example() {
    const [open, setOpen] = useState(['surfaces']);
    return <WorkspaceBottomDock tabs={['surfaces', 'timeline', 'audio'].map(id => ({ id, label:id, icon:null }))}
      activeTab={null} activeTabs={open} onTabChange={() => {}}
      onTabToggle={id => setOpen(current => current.includes(id) ? current.filter(p => p !== id) : [...current, id])}>
      {open.map(id => <section key={id}>{id} editor</section>)}
    </WorkspaceBottomDock>;
  }
  const view = render(<Example />);
  const button = (name: string) => screen.getByRole('button', { name });
  fireEvent.click(button('timeline'));
  expect(button('surfaces').getAttribute('aria-pressed')).toBe('true');
  expect(button('timeline').getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(button('audio'));
  fireEvent.click(button('timeline'));
  expect(button('audio').getAttribute('aria-pressed')).toBe('true');
  expect(button('timeline').getAttribute('aria-pressed')).toBe('false');
  expect(view.container.querySelector('[data-open=true]')).not.toBeNull();
  fireEvent.click(button('surfaces'));
  fireEvent.click(button('audio'));
  expect(view.container.querySelector('[data-open=false]')).not.toBeNull();
  button('surfaces').focus();
  fireEvent.keyDown(button('surfaces'), { key:'End' });
  expect(document.activeElement).toBe(button('audio'));
  fireEvent.click(button('audio'));
  expect(screen.getByText('audio editor')).toBeTruthy();
  view.unmount();
});
