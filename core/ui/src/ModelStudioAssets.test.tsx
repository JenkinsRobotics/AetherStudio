import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TransformFields } from './TransformFields';
import { SurfacePresetPicker } from './SurfacePresetPicker';
import { modelStudioSurfaces } from './model-studio-presets';
import { aetherThemes, aetherViewportThemes } from './themes';
afterEach(cleanup);
test('vector edits keep caller units, optional locks and constraints without owning transforms', () => {
  const commit=vi.fn(), lock=vi.fn();
  render(<TransformFields label="Translation" values={[1,2,3]} unit="mm" locked={[true,false,false]} onToggleLock={lock} onCommit={commit}/>);
  expect(screen.getByRole('textbox',{name:'Translation X'}).hasAttribute('disabled')).toBe(true);
  const input=screen.getByRole('textbox',{name:'Translation Y'});
  fireEvent.change(input,{target:{value:'25'}});fireEvent.keyDown(input,{key:'Enter'});
  expect(commit).toHaveBeenCalledWith(1,25);
  fireEvent.click(screen.getByRole('button',{name:'Unlock Translation X'}));expect(lock).toHaveBeenCalledWith(0);
});
test('surface selection supplies an identity and disabled selectors cannot edit a document', () => {
  const select=vi.fn();const {rerender}=render(<SurfacePresetPicker presets={modelStudioSurfaces} onSelect={select}/>);
  fireEvent.click(screen.getByRole('button',{name:'Apply Sage'}));expect(select).toHaveBeenCalledWith('model-studio-sage');
  rerender(<SurfacePresetPicker presets={modelStudioSurfaces} selectedId="model-studio-sage" disabled onSelect={select}/>);
  expect(screen.getByRole('button',{name:'Apply Sage'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'Apply Copper'}));expect(select).toHaveBeenCalledTimes(1);
});
test('Model Studio interface and viewport presets are in the ordinary theme catalogs', () => {
  expect(aetherThemes.find(p=>p.id==='model-studio')?.modes.dark['color-bg-app']).toBe('#101112');
  expect(aetherViewportThemes.find(p=>p.id==='model-studio')?.modes.light['viewport-bg-top']).toBe('#101112');
});
