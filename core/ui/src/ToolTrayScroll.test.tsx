import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ToolTrayScroll } from './ToolTrayScroll';
import { WORKSPACE_RIBBON_DENSITIES } from './WorkspaceRibbon';
afterEach(() => vi.restoreAllMocks());
test('density choices use only the three presentation names', () => {
  expect(WORKSPACE_RIBBON_DENSITIES.map(x => x.label)).toEqual(['Compact','Standard','Expanded']);
});
test('overflow tools respond to wheel, arrows and keyboard without intercepting zoom', () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
  render(<ToolTrayScroll role="tabpanel" label="Tools"><div>Tools</div></ToolTrayScroll>);
  const viewport = screen.getByLabelText('Tools scroll area');
  expect((screen.getByRole('button', {name:'Scroll tools left'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.wheel(viewport, {deltaX:60}); expect(viewport.scrollLeft).toBe(60);
  fireEvent.wheel(viewport, {deltaY:40}); expect(viewport.scrollLeft).toBe(100);
  fireEvent.wheel(viewport, {deltaY:40,ctrlKey:true}); expect(viewport.scrollLeft).toBe(100);
  fireEvent.click(screen.getByRole('button', {name:'Scroll tools right'})); expect(viewport.scrollLeft).toBe(250);
  fireEvent.keyDown(viewport, {key:'Home'}); expect(viewport.scrollLeft).toBe(0);
  fireEvent.keyDown(viewport, {key:'End'}); expect(viewport.scrollLeft).toBe(600);
});
