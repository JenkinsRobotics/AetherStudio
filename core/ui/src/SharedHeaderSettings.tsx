import { useState } from "react";
import { AetherIcon } from "./AetherIcon";
import { Checkbox } from "./Checkbox";
import { IconButton } from "./IconButton";
import { SelectField } from "./SelectField";
import { SettingsCard, SettingsRow } from "./SettingsWindow";
import { setHeaderPins, useAvailableHeaderControls, useHeaderPins, type HeaderControlConfiguration } from "./header-controls";

function HeaderPins({ config }: { config: HeaderControlConfiguration }) {
  const pins = useHeaderPins(config.appID, config.defaults);
  const selected = pins.flatMap(id => config.controls.find(item => item.id === id) ?? []);
  const controls = [...selected, ...config.controls.filter(item => !pins.includes(item.id))];
  const move = (id: string, step: number) => {
    const target = selected[selected.findIndex(item => item.id === id) + step];
    if (!target) return;
    const next = [...pins], from = next.indexOf(id), to = next.indexOf(target.id);
    [next[from], next[to]] = [next[to], next[from]];
    setHeaderPins(config.appID, next);
  };
  return <SettingsCard title="Pinned header icons" caption={`Choose the icons in ${config.name}'s header. Changes are saved on this device. Settings and your account remain available.`}>
    {controls.map(item => {
      const checked = pins.includes(item.id), index = selected.findIndex(value => value.id === item.id);
      return <SettingsRow key={item.id} label={item.label} icon={<AetherIcon name={item.icon}/>}>
        <Checkbox label="" aria-label={`Show ${item.label} in header`} checked={checked} onChange={() => setHeaderPins(config.appID, checked ? pins.filter(id => id !== item.id) : [...pins, item.id])}/>
        <IconButton size="small" style={{ visibility: checked ? undefined : "hidden" }} aria-hidden={!checked} label={`Move ${item.label} earlier`} disabled={!checked || index === 0} onClick={() => move(item.id, -1)}><AetherIcon name="chevron-up"/></IconButton><IconButton size="small" style={{ visibility: checked ? undefined : "hidden" }} aria-hidden={!checked} label={`Move ${item.label} later`} disabled={!checked || index === selected.length - 1} onClick={() => move(item.id, 1)}><AetherIcon name="chevron-down"/></IconButton>
      </SettingsRow>;
    })}
  </SettingsCard>;
}

/** The Settings Header pane lists only controls provided by a mounted app header. */
export function SharedHeaderSettings({ appID }: { appID?: string }) {
  const headers = useAvailableHeaderControls();
  const [selected, setSelected] = useState("");
  const config = headers.find(header => header.appID === (appID ?? selected)) ?? (!appID ? headers[0] : undefined);
  if (!config) return <SettingsCard title="Header"><p>Open an application header to choose its pinned icons.</p></SettingsCard>;
  return <>
    {!appID && headers.length > 1 && <SettingsCard><SettingsRow label="Application"><SelectField aria-label="Header application" value={config.appID} options={headers.map(header => ({ value: header.appID, label: header.name }))} onChange={event => setSelected(event.target.value)}/></SettingsRow></SettingsCard>}
    <HeaderPins key={config.appID} config={config}/>
  </>;
}
