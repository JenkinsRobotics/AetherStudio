/// <reference types="vite/client" />
import source from "./account.js?raw";
import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); document.body.innerHTML = ''; });
it('shows one shared app row with confirmed connection, outage and recovery', async () => {
  vi.useFakeTimers();
  document.head.innerHTML = '<meta name="aether-app" content="map">';
  document.body.innerHTML = '<div id="root"></div>';
  const fetcher = vi.fn(async () => ({ ok: true, text: async () => '', json: async () => ({ name: 'Jenkins Robotics', user: null, apps: [{ id: 'map', name: 'Aether Map' }] }) }));
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('BroadcastChannel', undefined);
  new Function(source)();
  await vi.waitFor(() => expect(document.querySelector('.suite-status-row')?.getAttribute('data-connection')).toBe('connected'));
  expect(document.querySelector('.aui-application-status__name')?.textContent).toBe('Aether Map');
  expect(document.querySelector('.aui-application-status__company')?.textContent).toBe('Jenkins Robotics');
  expect(document.querySelector('.aui-application-status__identity')?.firstElementChild?.getAttribute('role')).toBe('status');
  expect(document.body.classList.contains('suite-has-status-row')).toBe(true);
  window.dispatchEvent(new Event('offline'));
  expect(document.querySelector('.aui-application-status__connection-label')?.textContent).toBe('Studio unavailable');
  window.dispatchEvent(new Event('online'));
  await vi.waitFor(() => expect(document.querySelector('.suite-status-row')?.getAttribute('data-connection')).toBe('connected'));
  expect(document.querySelectorAll('.suite-status-row')).toHaveLength(1);
  fetcher.mockRejectedValue(new Error('unreachable'));
  window.dispatchEvent(new Event('focus'));
  await vi.waitFor(() => expect(document.querySelector('.suite-status-row')?.getAttribute('data-connection')).toBe('offline'));
});
