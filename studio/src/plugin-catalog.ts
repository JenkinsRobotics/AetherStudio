import type { AgentPlugin } from '@aether/session/agent';
export function filterPlugins(plugins: readonly AgentPlugin[], filter: string, query: string) {
  const search = query.trim().toLocaleLowerCase();
  return plugins.filter(p => (filter !== 'installed' || p.installed) && (filter !== 'connected' || p.account.connected) && `${p.name} ${p.publisher} ${p.description}`.toLocaleLowerCase().includes(search));
}
export function pluginStatus(p: AgentPlugin): string {
  if (!p.capabilities.chat && !p.capabilities.imageGeneration && !p.capabilities.videoGeneration) return 'Unavailable';
  if (!p.installed) return 'Not installed';
  if (!p.runtimeReady) return 'Needs repair';
  return p.enabled ? 'Enabled' : 'Disabled';
}
export function pluginControls(p: AgentPlugin, admin: boolean, canManage: boolean) {
  return {
    install: canManage && (!p.installed || !p.runtimeReady),
    enable: canManage && p.installed && p.runtimeReady && (admin || !p.enabled),
    login: !admin && p.installed && p.runtimeReady && p.enabled,
    askAdmin: !admin && !canManage && !p.installed,
  };
}
