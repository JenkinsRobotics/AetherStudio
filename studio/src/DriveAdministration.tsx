import {useEffect, useState} from 'react';
import {AetherIcon, Button, Dialog, TextField, SelectField} from '@aether/ui';
import {DriveMembers} from "@aether/session/library/members";
import {driveRequest, type DriveContext} from "@aether/session/library/drive-api";

/** Organization provisioning belongs to the guarded Studio Admin Center. */
export function DriveAdministration() {
  const [context, setContext] = useState<DriveContext | null>(null);
  const [organization, setOrganization] = useState('');
  const [form, setForm] = useState<'organization' | 'workspace' | null>(null);
  const [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [icon, setIcon] = useState('');
  const iconOptions = [{value:'',label:'Initials'}, ...['folder','settings','group','camera','film','cube','code','shield','star'].map(value => ({value,label:value[0].toUpperCase()+value.slice(1)}))];
  const [members, setMembers] = useState<{workspace?: string} | null>(null);
  async function load() {
    const result = await driveRequest<DriveContext>('administration');
    setContext(result);
    setOrganization(current => result.organizations.some(org => org.id === current) ? current : result.organizations[0]?.id ?? '');
  }
  useEffect(() => { void load().catch(e => setError(e.message)); }, []);
  const supportsIcons = !!(context as (DriveContext & {capabilities?: {workspace_icons?: boolean}}) | null)?.capabilities?.workspace_icons;
  const org = context?.organizations.find(item => item.id === organization);
  const start = (kind: 'organization' | 'workspace') => {setName(''); setIcon(''); setError(''); setForm(kind);};
  return <>
    <div className="page-heading"><div><h1>Organizations & workspaces</h1><p>Set up team file spaces and manage membership across this server.</p></div>
      <Button primary onClick={() => start('organization')}><AetherIcon name="new" />New organization</Button></div>
    {error && <p role="alert">{error}</p>}
    {!context ? <p role="status">Loading organizations…</p> : <>
      <section className="section"><div className="section-heading"><h2>Organization</h2></div>
        <label className="field" style={{maxWidth: 440}}><span>Organization</span><SelectField aria-label="Organization" value={organization} onChange={e => {setOrganization(e.target.value); setMembers(null);}}
          options={context.organizations.map(item => ({value: item.id, label: item.name}))} /></label>
        <p>Organization membership controls access to its shared workspaces. Personal files remain private.</p>
        <div className="actions"><Button disabled={!org} onClick={() => setMembers({})}><AetherIcon name="group" />Organization members</Button>
          <Button disabled={!org} onClick={() => start('workspace')}><AetherIcon name="new" />Create workspace</Button></div>
      </section>
      <div className="table-wrap"><table aria-label="Managed workspaces"><thead><tr><th>Workspace</th><th>Type</th><th>Actions</th></tr></thead><tbody>
        {context.workspaces.filter(item => item.organization === organization).map(item => <tr key={item.id}>
          <td>{item.name}{supportsIcons && <SelectField aria-label={`Icon for ${item.name}`} value={(item as typeof item & {icon?: string}).icon ?? ''} options={iconOptions} onChange={async e => {
            try { await driveRequest('workspace_icon', {organization, workspace:item.id, icon:e.target.value || null}); await load(); } catch(e) {setError((e as Error).message);}
          }} />}</td><td>{item.is_default ? 'Organization workspace' : 'Team workspace'}</td>
          <td><Button onClick={() => setMembers({workspace: item.id})}><AetherIcon name="group" />Manage members of {item.name}</Button></td>
        </tr>)}
      </tbody></table></div>
    </>}
    {form && <Dialog open title={`New ${form}`} onClose={() => {if (!busy) setForm(null);}}
      actions={<><Button disabled={busy} onClick={() => setForm(null)}>Cancel</Button><Button primary disabled={busy || !name.trim()} onClick={async () => {
        setBusy(true); setError('');
        try {const result = await driveRequest<{id: string}>(`${form}_create`, {name: name.trim(), organization, ...(form === 'workspace' && supportsIcons ? {icon:icon || null} : {})});
          await load(); if (form === 'organization') setOrganization(result.id); setForm(null);
        } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
      }}>Create</Button></>}>
      <label className="field"><span>Name</span><TextField aria-label="Name" autoFocus maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      {form === 'workspace' && supportsIcons && <label className="field"><span>Workspace icon</span><SelectField aria-label="Workspace icon" value={icon} options={iconOptions} onChange={e => setIcon(e.target.value)} /></label>}
      {error && <p role="alert">{error}</p>}
    </Dialog>}
    {members && context && <DriveMembers context={context} organization={organization} workspace={members.workspace}
      onClose={() => setMembers(null)} onChanged={() => void load().catch(e => setError(e.message))} />}
  </>;
}
