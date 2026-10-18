import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { StudioWorkspace } from './StudioWorkspace';
import { StudioDocumentBar } from './StudioDocumentBar';

test('studio keeps the document tree beside auxiliary editors and retains their drafts', async () => {
  const { container } = render(<StudioWorkspace animatePanels={false} pinnedPanels={['features']}
    defaultOpenLeft={['features']} defaultOpenRight={['properties']}
    workspaceControls={<button>Design</button>} toolbar={<button>Draw</button>}
    leftPanels={[
      { id:'features', title:'Features', icon:'', content:<input aria-label="Feature draft"/> },
      { id:'comments', title:'Comments', icon:'', content:<input aria-label="Comment draft"/> },
      { id:'history', title:'Versions', icon:'', content:'Version graph' },
    ]}
    rightPanels={[{id:'properties',title:'Properties',icon:'',content:'Selection properties'}]}>Drawing</StudioWorkspace>);
  const feature = screen.getByLabelText('Feature draft');
  fireEvent.change(feature, {target:{value:'Shell'}});
  fireEvent.click(screen.getByLabelText('Comments'));
  const draft = screen.getByLabelText('Comment draft');
  fireEvent.change(draft, {target:{value:'Keep this draft'}});
  expect(feature.closest('.aui-studio-pinned')).not.toBeNull();
  expect(screen.getByLabelText('Features').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByLabelText('Properties').getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByLabelText('Versions'));
  expect(screen.getByLabelText('Comments').getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByLabelText('Comments'));
  expect(screen.getByLabelText('Comment draft')).toBe(draft);
  expect((draft as HTMLInputElement).value).toBe('Keep this draft');
  fireEvent.keyDown(screen.getByLabelText('Resize features sidebar width'),{key:'ArrowRight'});
  await waitFor(()=>expect(container.querySelector('.aui-studio-pinned')?.parentElement?.getAttribute('style')).toContain('226px'));
  expect(container.querySelector('.aui-studio-tool-tray')?.textContent).toBe('Draw');
  expect(container.querySelector('.aui-shell-fltoolbar')?.textContent).toBe('Design');
});

test('studio identity preserves product actions and uses the real account slot', () => {
  const open = vi.fn();
  render(<StudioDocumentBar windowChrome={false} documentName="Train cart wheel"
    application={{id:'cad',name:'Aether CAD',apps:[]}} account={<button onClick={open}>Account</button>}
    documentState={<span>Main</span>}/>);
  expect(screen.getByText('Train cart wheel')).toBeTruthy();
  expect(screen.getByRole('button', {name: /applications/i})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Account'}));
  expect(open).toHaveBeenCalledOnce();
  expect(screen.queryByText('Design')).toBeNull();
});
