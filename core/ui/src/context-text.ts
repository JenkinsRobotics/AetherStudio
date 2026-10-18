import type { ContextCommand } from './context-commands';

/** Capture before the menu takes focus; never send a field command to the scene. */
export function textContextCommands(target: Element): ContextCommand[] | null {
  const field = target.closest('input, textarea, [contenteditable="true"]');
  if (!(field instanceof HTMLElement)) return null;
  const input = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field : null;
  if (input && (input.disabled || input.selectionStart === null)) return [];
  const start = input?.selectionStart ?? 0, end = input?.selectionEnd ?? 0;
  const selection = window.getSelection();
  const range = !input && selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  const text = input ? input.value.slice(start, end) : selection?.toString() ?? '';
  const editable = !input?.readOnly;
  const restore = () => { field.focus(); if (input) input.setSelectionRange(start, end); else if (range) { selection?.removeAllRanges(); selection?.addRange(range); } };
  const replace = (value: string) => {
    restore();
    if (input) {
      const next = input.value.slice(0, start) + value + input.value.slice(end);
      const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, next);
      input.setSelectionRange(start + value.length, start + value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (!document.execCommand('insertText', false, value)) throw new Error('Use the keyboard shortcut to paste into this editor.');
  };
  const copy = async () => { restore(); if (!document.execCommand?.('copy')) await navigator.clipboard.writeText(text); };
  return [
    { id:'text-cut', label:'Cut', heading:'Text', shortcut:'Mod+X', disabled:!editable || !text || input?.type === 'password', run:async () => { await copy(); replace(''); } },
    { id:'text-copy', label:'Copy', shortcut:'Mod+C', disabled:!text || input?.type === 'password', run:copy },
    { id:'text-paste', label:'Paste', shortcut:'Mod+V', disabled:!editable || !navigator.clipboard?.readText, run:async () => { try { replace(await navigator.clipboard.readText()); } catch { throw new Error('Clipboard access was unavailable. Use ⌘V or Ctrl+V in the field.'); } } },
    { id:'text-select-all', label:'Select all', shortcut:'Mod+A', run:() => { field.focus(); if (input) input.select(); else { const all = document.createRange(); all.selectNodeContents(field); selection?.removeAllRanges(); selection?.addRange(all); } } },
  ];
}
