import { useEffect, useState } from 'react';
import { AetherIcon, Button, Dialog } from '@aether/ui';
import { PluginMarketplace } from './PluginMarketplace';
import './PluginWindow.css';

/** App scope is presentation context, not authorization for server-wide installation. */
export function PluginLibrary({ app, canManage = false }: { app: string; canManage?: boolean }) {
  const [manage, setManage] = useState(false);
  useEffect(() => {
    if (window.parent === window) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') window.parent.postMessage({ type: 'aether-close-plugins' }, location.origin); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  return <div className="app-plugin-library">
    <header className="app-plugin-library__scope"><div><strong>Aether {['cad', 'io'].includes(app) ? app.toUpperCase() : app.charAt(0).toUpperCase() + app.slice(1)}</strong><p>Plugins and connected services for this app</p></div>
      {canManage && <Button aria-pressed={manage} onClick={() => setManage(!manage)}>{manage ? 'My connections' : 'Manage Studio installation'}</Button>}
    </header>
    <PluginMarketplace key={String(manage)} admin={manage && canManage} canManage={canManage} app={app}/>
  </div>;
}
export function PluginWindow({ app, canManage, onClose }: { app: string; canManage?: boolean; onClose: () => void }) {
  return <Dialog open title="Plugins" onClose={onClose}><PluginLibrary app={app} canManage={canManage}/></Dialog>;
}
/** Compose existing shared artwork; no product-specific copy of icon geometry. */
export function PluginsIcon() {
  return <span className="plugins-grid-icon" aria-hidden="true"><AetherIcon name="grid-2"/><AetherIcon name="plus"/></span>;
}
