/** What a file list shows about the file you picked.
 *
 *  Two pieces, both driven by the app's own data: the command bar that appears
 *  above the table once something is selected, and the details pane beside it —
 *  a preview, who has access, recent activity and the file's own information.
 *  Presentation only; the app loads the data and decides what the actions do.
 */
import { type ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { Button } from "./Button";
import { FieldRow } from "./FieldRow";
import { Inspector, InspectorSection } from "./Inspector";
import { MenuButton, type MenuItem } from "./Menu";
import { type PreviewKind } from "./FilePreview";
import "./FileDetails.css";

/** Someone the file is shared with. */
export interface FileAccess { id: string; name: string; role: string }

/** One thing that happened to the file. */
export interface FileActivity {
  id: string | number;
  /** The host's own verb for what happened. */
  action: string;
  author: string;
  /** Seconds since the epoch, as the host reports times. */
  created: number;
}

/** The host's event verbs in words, for the apps that show its history. */
const EVENT_WORDS: Record<string, string> = {
  created: "Created",
  save: "Edited",
  rename: "Renamed",
  move: "Moved",
  copy: "Copied",
  favorite: "Added to favorites",
  grant: "Updated sharing",
  link_create: "Shared a link",
  link_revoke: "Revoked a link",
  redeem: "Opened a shared link",
  trash: "Moved to the recycle bin",
  restore: "Restored",
  delete_forever: "Deleted permanently",
};

export function fileEventLabel(action: string) {
  return EVENT_WORDS[action] ?? action.replaceAll("_", " ");
}

export interface FileInformationRow { label: string; value: ReactNode }

/**
 * The selection command bar: the first few actions as buttons, the rest behind
 * one overflow menu. The items are the same ones the row's own context menu
 * uses, so an action never means two different things.
 */
export function FileCommandBar({ items, onSelect, inline = 5, label = "File actions", trailing }: {
  items: readonly MenuItem[];
  onSelect: (id: string) => void;
  /** How many actions to show as buttons before the overflow menu. */
  inline?: number;
  label?: string;
  trailing?: ReactNode;
}) {
  const front = items.slice(0, inline), rest = items.slice(inline);
  return (
    <div className="aui-file-command-bar" role="toolbar" aria-label={label}>
      {front.map((item) => (
        <button key={item.id} type="button" className="aui-file-command" disabled={item.disabled}
          title={item.disabled ? item.disabledReason : undefined} onClick={() => onSelect(item.id)}>
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
      {rest.length > 0 && (
        <MenuButton className="aui-file-command" label="More actions" items={rest} onSelect={onSelect}>
          <AetherIcon name="more" />
          <span>More</span>
        </MenuButton>
      )}
      {trailing}
    </div>
  );
}

/** The first letters of a name, for the access list's avatars. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export interface FileDetailsProps {
  name: string;
  /** The file's own icon, drawn by the app — it knows its document kinds. */
  icon?: ReactNode;
  subtitle?: ReactNode;
  /** An image to stand in for the icon, and the kind that decides whether it can. */
  previewURL?: string;
  previewKind?: PreviewKind;
  /** Opens the full preview. Omitted where the file has none. */
  onPreview?: () => void;
  actions?: ReactNode;
  /** Who else can reach the file. Undefined where the viewer may not ask. */
  access?: readonly FileAccess[];
  /** What the sharing amounts to in words, shown whether or not grants loaded. */
  accessNote?: ReactNode;
  onManageAccess?: () => void;
  /** Recent events, newest first. Undefined while they load. */
  activity?: readonly FileActivity[];
  information: readonly FileInformationRow[];
}

export function FileDetails({
  name, icon, subtitle, previewURL, previewKind, onPreview, actions,
  access, accessNote, onManageAccess, activity, information,
}: FileDetailsProps) {
  const thumbnail = previewURL && previewKind === "image";
  return (
    <Inspector className="aui-file-details">
      <div className="aui-file-details-hero">
        {onPreview ? (
          <button type="button" className="aui-file-details-thumb" onClick={onPreview}
            aria-label={`Preview ${name}`} data-image={thumbnail ? "" : undefined}>
            {thumbnail ? <img src={previewURL} alt="" /> : icon}
            <span className="aui-file-details-thumb-hint"><AetherIcon name="search" /> Preview</span>
          </button>
        ) : (
          <div className="aui-file-details-thumb">{icon}</div>
        )}
        <h2>{name}</h2>
        {subtitle !== undefined && <p>{subtitle}</p>}
      </div>
      {actions}
      {(access || accessNote || onManageAccess) && (
        <InspectorSection title="Has access"
          actions={onManageAccess && <Button onClick={onManageAccess}>Manage access</Button>}>
          {access && access.length > 0 && (
            <ul className="aui-file-details-people">
              {access.map((person) => (
                <li key={person.id}>
                  <span className="aui-file-details-avatar" aria-hidden="true">{initials(person.name)}</span>
                  <span className="aui-file-details-person">
                    <strong>{person.name}</strong>
                    <em>{person.role}</em>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {accessNote !== undefined && <p className="aui-file-details-note">{accessNote}</p>}
        </InspectorSection>
      )}
      {activity && (
        <InspectorSection title="Recent activity">
          {activity.length === 0 ? (
            <p className="aui-file-details-note">No activity yet.</p>
          ) : (
            <ol className="aui-file-details-activity">
              {activity.map((event) => (
                <li key={event.id}>
                  <AetherIcon name="history" />
                  <span>
                    <strong>{fileEventLabel(event.action)}</strong>
                    <em>{event.author} · {new Date(event.created * 1000).toLocaleString()}</em>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </InspectorSection>
      )}
      {information.length > 0 && (
        <InspectorSection title="File information">
          {information.map((row) => (
            <FieldRow key={row.label} label={row.label}><output>{row.value}</output></FieldRow>
          ))}
        </InspectorSection>
      )}
    </Inspector>
  );
}
