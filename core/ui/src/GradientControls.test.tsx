import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { GradientControls, type GradientControlsProps } from './GradientControls';
it('edits ordered stops and transparency through controlled callbacks', () => {
  function Harness() {
    const [value, setValue] = useState<GradientControlsProps['value']>({ kind: 'linear', angleDeg: 0, stops: [{ offset: 0, color: '#123456', opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 1 }] });
    return <><GradientControls value={value} onChange={setValue} /><output>{JSON.stringify(value)}</output></>;
  }
  render(<Harness />);
  expect((screen.getByRole('button', { name: 'Remove stop 1' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Add gradient stop' }));
  const opacity = screen.getByLabelText('Stop 2 opacity'); fireEvent.change(opacity, { target: { value: '35' } }); fireEvent.keyDown(opacity, { key: 'Enter' });
  expect(JSON.parse(screen.getByRole('status').textContent!).stops[1]).toMatchObject({ offset: .5, opacity: .35 });
  fireEvent.click(screen.getByRole('button', { name: 'Remove stop 2' }));
  expect(JSON.parse(screen.getByRole('status').textContent!).stops).toHaveLength(2);
});

it('disables every editor and action consistently and omits linear angle for radial paint', () => {
  const { container } = render(<GradientControls disabled value={{ kind: 'radial', angleDeg: 0, stops: [{ offset: 0, color: '#123456', opacity: 1 }, { offset: .5, color: '#abcdef', opacity: .5 }, { offset: 1, color: '#ffffff', opacity: 1 }] }} onChange={() => { throw Error('Disabled editor changed'); }} />);
  expect(container.querySelector('[aria-label="Gradient angle"]')).toBeNull();
  expect([...container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button')].every(el => el.disabled)).toBe(true);
});
