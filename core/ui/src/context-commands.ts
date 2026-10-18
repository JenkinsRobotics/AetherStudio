import { AetherIcon, aetherIconNames } from './AetherIcon';
import { createElement, useEffect, useRef, type RefObject } from 'react';
import type { MenuItem } from './Menu';

export interface ContextCommand extends Omit<MenuItem, 'children'> { run: () => void | Promise<void>; order?: number }
interface Scope { element?: RefObject<HTMLElement | null>; commands: () => readonly ContextCommand[] }
const scopes = new Set<Scope>();
let pointer: { target: Element; x: number; y: number } | null = null;
export function rememberContextTarget(target: Element, x: number, y: number) { pointer = { target, x, y }; }
export function contextTargetAt(anchor: unknown): Element | null {
  if (!pointer || !anchor || typeof anchor !== 'object' || !('x' in anchor) || !('y' in anchor)) return null;
  return anchor.x === pointer.x && anchor.y === pointer.y ? pointer.target : null;
}
/** Product-owned commands. A nearer work area replaces common IDs such as zoom. */
export function useContextCommands(commands: readonly ContextCommand[], element?: RefObject<HTMLElement | null>) {
  const current = useRef(commands); current.current = commands;
  useEffect(() => {
    const scope: Scope = { element, commands: () => current.current };
    scopes.add(scope); return () => { scopes.delete(scope); };
  }, [element]);
}
export function contextCommandsFor(target: Element): ContextCommand[] {
  const matches = [...scopes].filter(s => !s.element || s.element.current?.contains(target));
  const depth = (s: Scope) => { let n = 0, e = s.element?.current; while (e) { n++; e = e.parentElement; } return n; };
  matches.sort((a, b) => depth(a) - depth(b));
  const commands = new Map<string, ContextCommand>();
  matches.forEach(s => s.commands().forEach(c => commands.set(c.id, c)));
  return [...commands.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}
export function runContextCommand(command: ContextCommand) {
  if (command.disabled) return;
  try { Promise.resolve(command.run()).catch(report); } catch (error) { report(error); }
}
function report(error: unknown) {
  document.dispatchEvent(new CustomEvent('aether-context-error', { detail: error instanceof Error ? error.message : String(error) }));
}
function shortcutLabel(shortcut?: string): string | undefined {
  if (!shortcut?.includes('Mod+')) return shortcut;
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return mac ? shortcut.replace('Mod+Shift+', '⇧⌘').replace('Mod+', '⌘') : shortcut.replace('Mod+', 'Ctrl+');
}
export function contextCommandItems(commands: readonly ContextCommand[]): MenuItem[] {
  return commands.map(({ run: _run, heading, ...item }, index) => {
    const aliases: Record<string,string> = { 'zoom-fit':'fit', 'surface-fit':'fit', 'zoom':'zoom-in', 'application-settings':'settings' };
    const icon = aliases[item.id] ?? (aetherIconNames.includes(item.id) ? item.id : 'document');
    return { ...item, icon:item.icon ?? createElement(AetherIcon,{name:icon}), id:`aether:${item.id}`, shortcut:shortcutLabel(item.shortcut),
      separatorBefore:index > 0 && (!!item.separatorBefore || (!!heading && heading !== commands[index-1].heading)) };
  });
}
