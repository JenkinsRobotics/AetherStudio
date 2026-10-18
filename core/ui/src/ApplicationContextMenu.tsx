import { useEffect, useState } from 'react';
import { AetherIcon } from './AetherIcon';
import { Menu } from './Menu';
import { ToastStack } from './Toast';
import { useContextCommands, contextCommandsFor, contextCommandItems, rememberContextTarget, runContextCommand, type ContextCommand } from './context-commands';
function usesNativeTextMenu(target: Element): boolean {
  if (target.closest('input, textarea') || (target instanceof HTMLElement && target.isContentEditable)
      || target.closest('[contenteditable="true"], [contenteditable=""]')) return true;
  const selection = target.ownerDocument.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return false;
  for (let i = 0; i < selection.rangeCount; i++) {
    if (selection.getRangeAt(i).intersectsNode(target)) return true;
  }
  return false;
}

/** Fallback for the whole application, including chrome, empty space and fields.
 * Existing item menus prevent default themselves and retain their own actions. */
export function ApplicationContextMenu({ name, enabled = true }: { name: string; enabled?: boolean }) {
  const [menu, setMenu] = useState<{ x: number; y: number; commands: ContextCommand[] } | null>(null);
  const [error, setError] = useState('');
  useContextCommands(enabled ? [{ id:'application-settings', icon:<AetherIcon name="settings"/>, label:`${name} settings`, heading:'Application', order:1000, separatorBefore:true, run:() => { document.dispatchEvent(new CustomEvent('aether-open-settings', { cancelable:true })); } }] : []);
  useEffect(() => {
    if (!enabled) return;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const capture = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (usesNativeTextMenu(event.target)) {
        clearTimeout(pending);
        setMenu(null);
        // Keep the browser default, but prevent product bubble handlers from
        // replacing Copy/Paste with a file or canvas menu.
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault(); // Non-text canvas and object actions use Aether.
      clearTimeout(pending);
      if (event.target.closest('[role="menu"]')) return;
      rememberContextTarget(event.target, event.clientX, event.clientY);
      const commands = contextCommandsFor(event.target);
      // Let a product's item menu commit first. A canvas that only suppresses
      // the browser menu still receives the standard Aether fallback.
      pending = setTimeout(() => {
        if (document.querySelector('[role="menu"]')) return;
        setMenu({ x:event.clientX, y:event.clientY, commands });
      }, 0);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
      if (!(event.target instanceof Element) || usesNativeTextMenu(event.target)) return;
      event.preventDefault();
      const box = event.target.getBoundingClientRect();
      event.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, cancelable:true, clientX:box.left + Math.min(20, box.width / 2), clientY:box.top + Math.min(20, box.height / 2) }));
    };
    const problem = (event: Event) => setError((event as CustomEvent<string>).detail);
    document.addEventListener('contextmenu', capture, true);
    document.addEventListener('keydown', keyboard);
    document.addEventListener('aether-context-error', problem);
    return () => { document.removeEventListener('contextmenu', capture, true); clearTimeout(pending); document.removeEventListener('keydown', keyboard); document.removeEventListener('aether-context-error', problem); };
  }, [enabled, name]);
  return <>
    <Menu open={!!menu} anchor={menu} items={contextCommandItems(menu?.commands ?? [])} applicationCommands={false} ariaLabel="Aether commands" onClose={() => setMenu(null)} onSelect={id => { const command = menu?.commands.find(c => `aether:${c.id}` === id); if (command) runContextCommand(command); }} />
    {error && <ToastStack items={[{id:'context-error',kind:'error',title:'Command unavailable',message:error}]} onDismiss={() => setError('')} />}
  </>;
}
