import {AetherIcon} from './AetherIcon';
import {AppIcon} from './AppIcon';
import {FILE_TYPES, fileTypeFor, type FileIdentity, type FileTypeDefinition} from './file-types';
import './FileIcon.css';

const nativeApps: Record<string, string> = {
  part: 'cad', assembly: 'cad', drawing: 'cad', project: 'cad', show: 'map',
  character: 'animation', clip: 'animation', workspace: 'studio',
  sketch: 'sketch', circuit: 'io', vector: 'vector',
};
/** A document bearing its application's actual identity, never a redrawn A. */
export function FileIcon({file, type, icon, size = 24}: {file?: FileIdentity; type?: FileTypeDefinition; icon?: string; size?: number}) {
  const identity = type ?? (icon ? FILE_TYPES.find(item => item.icon === icon) : undefined) ?? fileTypeFor(file ?? {name: ''});
  if (icon && !FILE_TYPES.some(item => item.icon === icon)) return <AetherIcon name={icon} width={size} height={size} />;
  const app = nativeApps[identity.id];
  return <span className="aui-file-icon aui-file-icon--illustrated" data-icon={identity.icon} data-file-type={identity.id} data-file-app={app} aria-hidden="true" style={{width: size, height: size}}>
    <AetherIcon name={identity.icon} data-icon={undefined} data-file-artwork={identity.id} width={size} height={size} />
    {app && <span className="aui-file-icon-badge"><AppIcon app={app} size={size * .4} /></span>}
  </span>;
}
