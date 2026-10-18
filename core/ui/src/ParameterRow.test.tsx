import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ParameterRow } from './ParameterRow';

test('exact entry and slider share a value without truncating values outside the suggested interval', () => {
  const change = vi.fn();
  const view = render(<ParameterRow label="Speed" value={12} min={0} step={.05} sliderRange={{ min: 0, max: 5 }} onChange={change} />);
  expect(screen.getByRole('slider').getAttribute('max')).toBe('12');
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('12');
  fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
  expect(change).toHaveBeenLastCalledWith(3);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '2+4' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  expect(change).toHaveBeenLastCalledWith(6);
  view.rerender(<ParameterRow label="Speed" value={6} min={0} disabled onChange={change} />);
  expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
  expect(screen.queryByRole('slider')).toBeNull();
});

test('modulation markers reflect actual assignments and the badge opens their editor', () => {
  const edit = vi.fn();
  const { container } = render(<ParameterRow label="Motion" value={3} sliderRange={{ min: 0, max: 10 }} onChange={() => {}}
    modulation={{ label: 'LFO 3', onEdit: edit, range: { min: 2, max: 8 } }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Motion modulation' }));
  expect(edit).toHaveBeenCalledOnce();
  const marks = container.querySelectorAll<HTMLElement>('.aui-slider-range-mark');
  expect([...marks].map(mark => mark.style.left)).toEqual(['20%', '80%']);
});
