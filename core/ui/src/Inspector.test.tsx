import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Inspector, InspectorSection } from './Inspector';
import { FieldRow } from './FieldRow';
import { TextField } from './TextField';
import { ParameterRow } from './ParameterRow';

afterEach(cleanup);

test('inspector help is opt-in, errors stay visible, standalone form help remains visible', () => {
  render(<><FieldRow label="Outside" help="Standalone guidance"><TextField aria-label="Outside" /></FieldRow>
    <Inspector><InspectorSection title="Appearance">
      <FieldRow label="Name" htmlFor="name" help="Name guidance"><TextField id="name" /></FieldRow>
      <FieldRow label="Size" error="Enter a positive size"><TextField aria-label="Size" /></FieldRow>
    </InspectorSection></Inspector></>);
  expect(screen.getByText('Standalone guidance').closest('[hidden]')).toBeNull();
  expect(screen.getByText('Name guidance').hidden).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'About Name' }));
  expect(screen.getByText('Name guidance').hidden).toBe(false);
  expect(screen.getByRole('alert').textContent).toBe('Enter a positive size');
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Wall' } });
  expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Wall');
});

test('compact parameters retain numeric editing and keyboard-accessible help', () => {
  const change = vi.fn();
  render(<Inspector><ParameterRow label="Opacity" value={50} min={0} max={100}
    sliderRange={{ min: 0, max: 100 }} help="Editor opacity only" onChange={change} /></Inspector>);
  const field = screen.getByRole('textbox', { name: 'Opacity' });
  fireEvent.change(field, { target: { value: '65' } }); fireEvent.blur(field);
  expect(change).toHaveBeenCalledWith(65);
  expect(screen.getByText('Editor opacity only').hidden).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'About Opacity' }));
  expect(screen.getByText('Editor opacity only').hidden).toBe(false);
});
