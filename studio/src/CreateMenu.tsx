import { FileIcon, MenuButton, SidebarLabel, type AetherIconName, type MenuItem } from '@aether/ui';

export type CreateChoice =
  | 'design' | 'project' | 'folder' | 'part' | 'assembly' | 'import' | 'character' | 'show' | 'circuit' | 'sketch';

/** `[id, label, icon]`, in the order an app wants its creatable kinds listed. */
export type CreateMenuChoices = readonly (readonly [CreateChoice, string, AetherIconName])[];

const defaultChoices: CreateMenuChoices = [
  ['design', 'New design…', 'file-part'],
  ['project', 'Project document', 'file-project'],
  ['part', 'Part', 'file-part'],
  ['assembly', 'Assembly', 'file-assembly'],
];

/**
 * Create, grouped the way Jonathan asked for on 2026-10-04 from OneDrive's
 * menu: somewhere to put things, then ways to bring things in, then the things
 * this application can make. Folder and Import are supplied here rather than by
 * each app, because every library has them and their position is the structure.
 *
 * It draws the shared MenuButton rather than its own dropdown — this used to be
 * a hand-rolled menu with its own roving focus and outside-click handling, none
 * of which differed from the shared one, and which had no way to show the
 * separators this grouping needs.
 */
export function CreateMenu({ onChoose, disabled, items = defaultChoices }: {
  onChoose: (choice: CreateChoice) => void;
  disabled: boolean;
  items?: CreateMenuChoices;
}) {
  // An app may still pass folder or import in its own list; they belong to the
  // groups below, so they are not repeated among the document kinds.
  const kinds = items.filter(([id]) => id !== 'folder' && id !== 'import');
  const menu: MenuItem[] = [
    { id: 'folder', label: 'Folder', icon: <FileIcon icon="file-folder" size={18} /> },
    { id: 'import', label: 'Files upload', icon: <FileIcon icon="import" size={18} />, separatorBefore: true },
    ...kinds.map(([id, label, icon], index) => ({
      id, label, icon: <FileIcon icon={icon} size={18} />,
      separatorBefore: index === 0,
    })),
  ];
  return (
    <MenuButton
      density="comfortable"
      className="library-create"
      label="Create or upload"
      disabled={disabled}
      placement="bottom-start"
      items={menu}
      onSelect={(id) => onChoose(id as CreateChoice)}
    >
      <span className="library-create-plus" aria-hidden="true">+</span>
      <SidebarLabel>Create or upload</SidebarLabel>
    </MenuButton>
  );
}
