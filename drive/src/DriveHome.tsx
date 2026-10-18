import { selectFiles, selectionForAction } from "./file-selection";
import { organizationChildren } from "./workspace-root";
import { driveBackgroundMenu } from "./DriveContextMenus";
import { DriveSettings } from "./DriveSettings";
import { DRIVE_UPDATES } from "./DriveUpdates";
import { Inspector } from "@aether/ui";
import "@aether/session/library/FileDetailsInspector.css";
import { createNativeFile } from "@aether/session/library/create-native-file";
import { FilePreview, canPreview, previewKind } from "@aether/ui/file-preview";
import { FileDetails, type FileAccess, type FileActivity } from "@aether/ui/file-details";
import { DriveWorkspaces } from "./DriveWorkspaces";
import { listDriveFiles } from "./drive-listing";
import { DriveRecycleToolbar } from "./DriveRecycleToolbar";
import { DriveListControls } from "./DriveListControls";
import { DriveFileTools } from "./DriveFileTools";
import { ApplicationArtwork, ApplicationHeroArtwork } from "@aether/session/library/ApplicationArtwork";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApplicationListHeading,
  AppIcon,
  AetherIcon,
  type AetherIconName,
  FileIcon,
  ApplicationWelcome,
  ApplicationFileTable,
  Menu,
  fileTypeFor,
  ApplicationHomeFrame,
  ApplicationHomeHeader,
  Button,
  Breadcrumbs,
  ApplicationSidebar,
  Dialog,
  NewFileDialog,
  IconButton,
  MenuButton,
  SidebarLabel,
  SidebarRow,
  SidebarGroup,
  WorkspaceIcon,
  TextField,
} from "@aether/ui";
import {
  DriveDocument,
  DriveMove,
  DrivePreview,
  DriveShare,
} from "./DriveDialogs";
import {
  driveRequest,
  bytes,
  editorURL,
  encodeFile,
  fileType,
  type DriveContext,
  type DriveFile,
  type DriveWorkspace,
} from "@aether/session/library/drive-api";
import { uploadToDrive } from "./drive-upload";
import "@aether/session/library/library.css";
import "./DriveHome.css";

type View =
  | "home"
  | "personal"
  | "recent"
  | "shared"
  | "favorites"
  | "trash"
  | "workspace"
  | "workspaces"
  | "activity";
const shellQuote = (value: unknown) =>
  "'" + String(value ?? "").replaceAll("'", "'\"'\"'") + "'";
const titles: Record<View, string> = {
  home: "Home",
  personal: "My files",
  recent: "Recent",
  shared: "Shared",
  favorites: "Favorites",
  trash: "Recycle bin",
  workspace: "Workspace files",
  workspaces: "Workspaces",
  activity: "Activity",
};
const views: [View, string][] = [
  ["home", "home"],
  ["personal", "folder"],
  ["shared", "link"],
  ["favorites", "star"],
  ["workspaces", "folder"],
  ["trash", "delete"],
];
const createTypes = [
  ["cad", "Part", "file-part", "part"],
  ["cad", "Assembly", "file-assembly", "assembly"],
  ["map", "Map show", "file-show", "show"],
  ["sketch", "Sketch", "file-sketch", "sketch"],
  ["animation", "Character", "file-character", "character"],
  ["io", "Circuit", "file-circuit", "circuit"],
] as const;
export function DriveHome() {
  const [context, setContext] = useState<DriveContext | null>(null),
    [organization, setOrganization] = useState("default"),
    [workspace, setWorkspace] = useState<string | null>(null),
    [parent, setParent] = useState<string | null>(null),
    [view, setView] = useState<View>("home");
  const [creatingNative, setCreatingNative] = useState<{app: string; kind: string} | null>(null);
  const [sharedScope, setSharedScope] = useState<"with" | "by">("with");
  const [listingError, setListingError] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(true);
  // Catalog refreshes may change workspace preferences without changing scopes.
  const organizationKey = JSON.stringify(context?.organizations.map(o => o.id) ?? null);
  const [files, setFiles] = useState<DriveFile[]>([]),
    [path, setPath] = useState<{ id: string; name: string }[]>([]),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [nameFilter, setNameFilter] = useState(""),
    [sortAsc, setSortAsc] = useState(true),
    [sort, setSort] = useState("name"),
    [grid, setGrid] = useState(false),
    [details, setDetails] = useState(false);
  const [events, setEvents] = useState<
      {
        id: number | string;
        action: string;
        author: string;
        created: number;
        detail: string;
      }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [form, setForm] = useState<
      "folder" | "rename" | "text" | null
    >(null),
    [name, setName] = useState(""),
    [text, setText] = useState("");
  const [share, setShare] = useState<DriveFile | null>(null),
    [preview, setPreview] = useState<DriveFile | null>(null),
    [move, setMove] = useState<"move" | "copy" | null>(null),
    [confirm, setConfirm] = useState<"trash" | "delete_forever" | null>(null),
    [documentTab, setDocumentTab] = useState<
      "versions" | "comments" | "tasks" | "notes" | null
    >(null);
  const input = useRef<HTMLInputElement>(null),
    request = useRef(0),
    cancelUpload = useRef(false);
  const [sync, setSync] = useState(false);
  const [settings, setSettings] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);
  /* Right-click opens the same actions the row's ⋯ button offers, at the
     pointer — OneDrive's behaviour, and the one people reach for first
     (Jonathan, 2026-10-04). The items and their dispatcher already existed;
     only the trigger was missing. */
  const [workspaceMenu, setWorkspaceMenu] = useState<{x:number; y:number; workspace:DriveContext["workspaces"][number]} | null>(null);
  const [backgroundMenu, setBackgroundMenu] = useState<{x: number; y: number} | null>(null);
  const [rowMenu, setRowMenu] = useState<{ file: DriveFile; x: number; y: number } | null>(null);
  /* Dragging a row within the table also fires these handlers; only an actual
     file drag from outside should arm the upload overlay. */
  const isFileDrag = (event: { dataTransfer: DataTransfer | null }) =>
    Array.from(event.dataTransfer?.types ?? []).includes("Files");
  /* Drag depth, not a boolean: dragging over a child fires dragleave on the
     parent, so a boolean flickers the overlay off while the pointer is still
     inside. Counting enter/leave pairs is the standard fix. */
  const [dragDepth, setDragDepth] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<{
    name: string;
    percent: number;
  } | null>(null);
  const current = useMemo(() => files.filter((f) => selected.has(f.id)), [files, selected]),
    file = current[0];
  /* What the details pane knows beyond the row itself: who can reach the file,
     and what has lately happened to it. Both are per-file host reads, so they
     wait for a selection instead of loading with the list. The id travels with
     them so a stale answer never decorates the next file you pick. */
  const [fileDetail, setFileDetail] = useState<{
    id: string;
    access?: FileAccess[];
    activity?: FileActivity[];
  }>({ id: "" });
  const activeWorkspace = context?.workspaces.find(w => w.id === workspace);
  const organizationWorkspaces = view === 'workspace' ? organizationChildren(context?.workspaces ?? [], workspace, parent, query) : [];
  const org = context?.organizations.find((o) => o.id === organization);
  const detailID = details && file && !file.trashed ? file.id : "";
  const detailManageable = Boolean(file?.manageable);
  useEffect(() => {
    setFileDetail({ id: detailID });
    if (!detailID) return;
    let active = true;
    void Promise.all([
      detailManageable
        ? driveRequest<{ grants: { user_id: string; role: string; name: string }[] }>("sharing", { id: detailID }).catch(() => null)
        : null,
      driveRequest<{ events: FileActivity[] }>("activity", { organization, file: detailID }).catch(() => null),
    ]).then(([sharing, history]) => {
      if (!active) return;
      setFileDetail({
        id: detailID,
        access: sharing?.grants.map((g) => ({ id: g.user_id, name: g.name, role: g.role })),
        activity: history?.events,
      });
    });
    return () => { active = false; };
  }, [detailID, detailManageable, organization]);
  const dest = {
    organization,
    workspace: view === "workspace" || parent ? workspace : null,
    parent,
  };
  const loadContext = useCallback(async () => {
    const c = await driveRequest<DriveContext>("context");
    setContext(c);
    return c;
  }, []);
  const load = useCallback(async () => {
    const organizationIDs = JSON.parse(organizationKey) as string[] | null;
    if (organizationIDs === null) return;
    const generation = ++request.current;
    setLoadingFiles(true);
    setListingError("");
    try {
      if (view === "workspaces") {
        const c = await driveRequest<DriveContext>("context");
        if (generation === request.current) setContext(c);
        return;
      }
      if (view === "activity") {
        const result = await driveRequest<{ events: typeof events }>(
          "activity",
          { organization },
        );
        if (generation === request.current) setEvents(result.events);
        return;
      }
      const result = await listDriveFiles({
        organization: view === "workspace" || parent ? organization : "all",
        workspace,
        parent,
        view: view === "home" ? "recent" : view,
        query,
        shared_scope: sharedScope,
      }, organizationIDs.map(id => ({ id })));
      if (generation === request.current) {
        setFiles(result.files);
        setPath(result.path);
      }
    } catch (e) {
      if (generation === request.current) {
        setFiles([]);
        setListingError((e as Error).message);
      }
    } finally {
      if (generation === request.current) setLoadingFiles(false);
    }
  }, [organization, organizationKey, workspace, parent, view, query, sharedScope]);
  useEffect(() => {
    void loadContext()
      .then((c) => {
        const requested = new URLSearchParams(location.search);
        const link = requested.get("share");
        if (link)
          void driveRequest<DriveFile>("redeem", { token: link })
            .then((f) => {
              setOrganization(f.organization);
              setView(f.workspace ? "workspace" : "shared");
              setWorkspace(f.workspace);
              setParent(f.parent);
              setSelected(new Set([f.id]));
              setNotice(`Access granted to ${f.name}`);
              history.replaceState(null, "", "/drive/");
            })
            .catch((e) => setError(e.message));
        else if (requested.get("file"))
          void driveRequest<DriveFile>("details", { id: requested.get("file") })
            .then((f) => {
              setOrganization(f.organization);
              setView(
                f.workspace
                  ? "workspace"
                  : f.owner_id === c.user.id
                    ? "personal"
                    : "shared",
              );
              setWorkspace(f.workspace);
              setParent(f.parent);
              setSelected(new Set([f.id]));
              setDetails(true);
            })
            .catch((e) => setError(e.message));
        else if (
          !c.organizations.some((o) => o.id === organization) &&
          c.organizations[0]
        )
          setOrganization(c.organizations[0].id);
      })
      .catch((e) => { setListingError(e.message); setLoadingFiles(false); });
  }, [loadContext]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 180 : 0);
    return () => {
      clearTimeout(timer);
      request.current++;
    };
  }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      await load();
      setBusy(false);
    }
  };
  const navigate = (next: View, ws: string | null = null) => {
    setView(next);
    if (next === "shared") { setSort("shared_at"); setSortAsc(false); setType("all"); }
    else if (next === "trash") { setSort("deleted_at"); setSortAsc(false); setGrid(false); }
    else if (view === "shared" || view === "trash") { setSort("name"); setSortAsc(true); }
    setWorkspace(ws);
    if (ws) {const owner = context?.workspaces.find(w => w.id === ws); if (owner) setOrganization(owner.organization);}
    else setOrganization(context?.organizations[0]?.id ?? "default");
    if (next === "workspace" && ws) void driveRequest<{workspaces: DriveContext["workspaces"]}>("workspace_open", {workspace: ws})
      .then(result => setContext(previous => previous ? {...previous, workspaces: result.workspaces} : previous))
      .catch(e => setError((e as Error).message));
    setParent(null);
    setSelected(new Set());
    setQuery("");
    setNameFilter("");
    setError("");
  };
  const open = async (f: DriveFile) => {
    if (f.kind === "folder") {
      setQuery("");
      setOrganization(f.organization);
      setParent(f.id);
      setSelected(new Set());
      if (view === "home" || view === "recent" || view === "favorites")
        setView(f.workspace ? "workspace" : "personal");
      setWorkspace(f.workspace);
      return;
    }
    await driveRequest("open", { id: f.id });
    if (["cad", "map", "animation", "sketch", "io"].includes(f.app))
      location.assign(editorURL(f));
    else setPreview(f);
  };
  const download = async (f: DriveFile) => {
    const a = document.createElement("a");
    a.href = `/api/drive/download?id=${encodeURIComponent(f.id)}`;
    a.download = f.kind === "folder" ? f.name + ".zip" : f.name;
    a.click();
  };
  const upload = async (list: File[]) => {
    cancelUpload.current = false;
    const folders = new Map<string, string>();
    try {
      for (const f of list) {
        let target = { ...dest };
        const parts = f.webkitRelativePath.split("/").slice(0, -1);
        let path = "";
        for (const part of parts) {
          path += `/${part}`;
          if (!folders.has(path)) {
            const folder = await driveRequest<DriveFile>("create", {
              ...target,
              kind: "folder",
              name: part,
            });
            folders.set(path, folder.id);
          }
          target = { ...target, parent: folders.get(path)! };
        }
        setUploadProgress({ name: f.name, percent: 0 });
        await uploadToDrive(
          f,
          target,
          context!.user.id,
          (percent) => setUploadProgress({ name: f.name, percent }),
          () => cancelUpload.current,
        );
      }
      setNotice(`Uploaded ${list.length} file${list.length === 1 ? "" : "s"}.`);
    } finally {
      setUploadProgress(null);
    }
  };
  const startForm = (kind: NonNullable<typeof form>) => {
    setName(
      kind === "rename"
        ? (file?.name ?? "")
        : kind === "text"
          ? "Notes.txt"
          : "",
    );
    setText("");
    setForm(kind);
  };
  const fileBrowser = view === "personal" || view === "workspace";
  const recycle = view === "trash";
  /* The recycle bin holds deleted files and the workspace directory is a list
     of workspaces, not a folder — neither is somewhere a dropped file can land. */
  const canUploadHere = !recycle && view !== "workspaces";
  /** The next previewable file in the list, so arrow keys walk what is on screen. */
  const previewNeighbour = (step: number) => {
    if (!preview) return null;
    const previewable = shown.filter((f) => f.kind !== "folder" && canPreview(f.name));
    const at = previewable.findIndex((f) => f.id === preview.id);
    return at < 0 ? null : previewable[at + step] ?? null;
  };
  const shown = useMemo(() => files
    .filter(f => (type === "all" || fileTypeFor(f).id === type) &&
      (`${f.name} ${f.owner} ${f.shared_by ?? ""}`.toLocaleLowerCase().includes(nameFilter.trim().toLocaleLowerCase())))
    .sort((a, b) => (fileBrowser ? Number(b.kind === "folder") - Number(a.kind === "folder") : 0) || (sortAsc ? 1 : -1) * (
      sort === "type" ? fileTypeFor(a).label.localeCompare(fileTypeFor(b).label) :
      sort === "modified" ? a.modified - b.modified :
      sort === "opened" ? (a.opened ?? a.modified) - (b.opened ?? b.modified) :
      sort === "size" ? (a.child_count ?? a.size) - (b.child_count ?? b.size) :
      sort === "owner" ? a.owner.localeCompare(b.owner) :
      sort === "modified_by" ? (a.modified_by ?? "").localeCompare(b.modified_by ?? "") :
      sort === "deleted_at" ? (a.deleted_at ?? 0) - (b.deleted_at ?? 0) :
      sort === "deleted_by" ? (a.deleted_by ?? "").localeCompare(b.deleted_by ?? "") :
      sort === "created_by" ? (a.created_by ?? "").localeCompare(b.created_by ?? "") :
      sort === "shared_at" ? (a.shared_at ?? 0) - (b.shared_at ?? 0) :
      sort === "shared_by" ? (a.shared_by ?? "").localeCompare(b.shared_by ?? "") :
      sort === "sharing" ? (a.sharing ?? "").localeCompare(b.sharing ?? "") :
      a.name.localeCompare(b.name, undefined, { numeric: true })
    )), [files, type, nameFilter, fileBrowser, sortAsc, sort]);
  const directoryRows = organizationWorkspaces
    .filter(w => (type === "all" || type === "folder") && w.name.toLocaleLowerCase().includes(nameFilter.trim().toLocaleLowerCase()))
    .sort((a,b) => (sortAsc ? 1 : -1) * a.name.localeCompare(b.name));
  const tableRows = [
    ...directoryRows.map(entry => ({id: `workspace:${entry.id}`, name: entry.name,
      icon: <FileIcon file={{name:entry.name,kind:"folder"}} size={28} />, location: "Workspace", date: "—", owner: org?.name ?? "Organization",
      entry, file: undefined as DriveFile | undefined})),
    ...shown.map(file => ({id: file.id, name: file.name, icon: <FileIcon file={file} size={28} />,
      location: recycle ? file.original_location ?? "—" : file.workspace ? context?.workspaces.find(w => w.id === file.workspace)?.name ?? "Workspace" : "My files",
      date: new Date(((view === "home" || view === "recent" ? file.opened : undefined) ?? file.modified) * 1000).toLocaleDateString(),
      owner: file.owner, file, entry: undefined as DriveWorkspace | undefined})),
  ];
  const fileTools = <DriveFileTools selectedCount={selected.size} clearSelection={() => setSelected(new Set())}
    sort={sort} setSort={setSort} sortAsc={sortAsc} setSortAsc={setSortAsc}
    grid={grid} setGrid={setGrid} details={details} setDetails={setDetails}
    busy={busy} refresh={() => void run(load)} fileBrowser={fileBrowser} shared={view === "shared"} recycle={recycle} />;
  const selectionAnchor = useRef<string | null>(null);
  const selectFile = (f: Pick<DriveFile, "id">, event: {shiftKey:boolean;ctrlKey:boolean;metaKey:boolean}) => {
    setSelected(previous => selectFiles(tableRows.map(row => row.id), previous, selectionAnchor.current, f.id, event.shiftKey, event.ctrlKey || event.metaKey));
    if (!event.shiftKey || !tableRows.some(row => row.id === selectionAnchor.current)) selectionAnchor.current = f.id;
  };
  const toggleFile = (f: DriveFile, checked: boolean) => setSelected(prev => {
    selectionAnchor.current = f.id;
    const next = new Set(prev);
    if (checked) next.add(f.id); else next.delete(f.id);
    return next;
  });
  const actions = (f: DriveFile) => recycle ? [
    { id: "restore", label: "Restore", icon: <AetherIcon name="restore" />, disabled: busy || !f.manageable },
    { id: "delete_forever", label: "Delete permanently", icon: <AetherIcon name="delete" />, danger: true, disabled: busy || !f.manageable },
  ] : [
    {
      id: "open",
      label: f.kind === "folder" ? "Open folder" : "Open",
      icon: <AetherIcon name="open" />,
    },
    {
      id: "favorite",
      separatorBefore: true,
      label: f.favorite ? "Remove from favorites" : "Add to favorites",
      icon: <AetherIcon name="star" />,
    },
    ...(f.kind !== "folder" && canPreview(f.name)
      ? [{ id: "preview", label: "Preview", icon: <AetherIcon name="search" /> }]
      : []),
    { id: "download", label: "Download", icon: <AetherIcon name="export" /> },
    {
      id: "share",
      separatorBefore: true,
      label: "Share / manage access",
      icon: <AetherIcon name="link" />,
      disabled: !f.manageable,
    },
    {
      id: "rename",
      label: "Rename",
      icon: <AetherIcon name="pencil" />,
      disabled: !f.writable,
    },
    {
      id: "move",
      label: "Move to",
      icon: <AetherIcon name="folder" />,
      disabled: !f.manageable,
    },
    { id: "copy", label: "Copy to", icon: <AetherIcon name="copy" /> },
    { id: "details", label: "File details", icon: <AetherIcon name="sidebar" />, separatorBefore: true },
    ...(["versions", "comments", "tasks", "notes"] as const).map((id) => ({
      id,
      label: {
        versions: "Versions and history",
        comments: "Comments",
        tasks: "Action items",
        notes: "Document notes",
      }[id],
      icon: (
        <AetherIcon
          name={
            {
              versions: "version-control",
              comments: "comment",
              tasks: "tasks",
              notes: "notes",
            }[id]
          }
        />
      ),
      disabled: f.kind === "folder",
    })),
    {
      id: "trash",
      separatorBefore: true,
      danger: true,
      label: "Move to recycle bin",
      icon: <AetherIcon name="delete" />,
      disabled: !f.manageable,
    },
  ];
  const choose = (id: string, f: DriveFile) => {
    /* Keep a multi-selection the row belongs to: Move, Copy and Recycle act on
       every selected file (`current`), so collapsing to one here would quietly
       apply a bulk action to a single file. Acting on a row outside the
       selection still replaces it, which is what both OneDrive and the row's
       own ⋯ button do. */
    setSelected((previous) => selectionForAction(id, f.id, previous));
    if (id === "restore") void run(async () => {
      for (const target of current.some(item => item.id === f.id) ? current : [f])
        await driveRequest("restore", {id: target.id, expected_structure_revision: target.structure_revision});
      setSelected(new Set());
    });
    else if (id === "delete_forever") setConfirm("delete_forever");
    else if (id === "details") setDetails(true);
    else if (id === "open") void run(() => open(f));
    else if (id === "preview") setPreview(f);
    else if (id === "download") void run(() => download(f));
    else if (id === "favorite")
      void run(() =>
        driveRequest("favorite", { id: f.id, favorite: !f.favorite }),
      );
    else if (id === "share") setShare(f);
    else if (id === "rename") {
      setName(f.name);
      setForm("rename");
    } else if (id === "copy" || id === "move") setMove(id);
    else if (id === "trash") setConfirm("trash");
    else if (["versions", "comments", "tasks", "notes"].includes(id))
      setDocumentTab(id as typeof documentTab);
  };
  /* What a multi-selection can still do: the actions that already act on every
     selected file. Copy needs no write access to the originals; moving and
     deleting do. */
  const bulkActions = !file ? [] : (recycle ? ["restore", "delete_forever"] : ["copy", "move", "trash"]).flatMap((id) => {
    const item = actions(file).find((a) => a.id === id);
    return item ? [{ ...item, disabled: busy || (id !== "copy" && current.some((f) => !f.manageable)) }] : [];
  });
  const creationItems = [
    { id: "folder", label: "Folder", icon: <AetherIcon name="file-folder" /> },

    { id: "upload", label: "Files upload", icon: <AetherIcon name="import" />,
      separatorBefore: true, disabled: busy || view === "trash" },
    { id: "upload-folder", label: "Folder upload", icon: <AetherIcon name="folder" />,
      disabled: busy || view === "trash" },

    { id: "text", label: "Text document", icon: <AetherIcon name="file-text" />, separatorBefore: true },
    ...createTypes
      .filter(([app]) =>
        context?.apps.some((a) => a.id === app && a.enabled),
      )
      .map(([app, label, icon, kind]) => ({
        id: `app:${app}:${kind}`,
        label,
        icon: <FileIcon icon={icon} size={18} />,
      })),
  ];
  const chooseCreation = (id: string) => {
    if (id === "upload") { if (view === "workspaces") navigate("personal"); input.current?.click(); }
    else if (id === "upload-folder") { if (view === "workspaces") navigate("personal"); folderInput.current?.click(); }
    else if (id.startsWith("app:")) {
      const [, app, kind] = id.split(":");
      setCreatingNative({app, kind});
    } else startForm(id as "folder" | "text");
  };
  return (
    <div style={{display:'contents'}} onMouseDown={event => {
      if ((event.shiftKey || event.metaKey || event.ctrlKey) && (event.target as Element).closest('.aui-application-file-table tbody tr, .drive-file-row') && !(event.target as Element).closest('input')) event.preventDefault();
    }} onContextMenu={event => {
      if ((event.target as Element).closest('input, textarea, [contenteditable="true"], [role="menu"], [role="dialog"]')) return;
      event.preventDefault(); event.stopPropagation();
      setRowMenu(null); setWorkspaceMenu(null);
      setBackgroundMenu({x:event.clientX,y:event.clientY});
    }}>
    <ApplicationHomeFrame design="studio" className="studio library-root drive-root" layout="header">
      <ApplicationHomeHeader design="studio" identity onSettings={()=>setSettings(true)}
        app="drive"
        name="Aether Drive"
        apps={context?.apps.filter((a) => a.enabled) ?? []}
        className="library-top"
        search={
          <TextField
            aria-label="Search Drive"
            placeholder="Search files and folders"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        }
      />
      <ApplicationSidebar brand={false} footer={<></>} userLabel={context?.user.name ?? "My files"} settings={{ onSelect: () => setSettings(true) }} id="drive-library" name="Aether Drive" icon={<AppIcon app="drive" size={32} />} homeUrl="/drive/" apps={context?.apps.filter((a) => a.enabled) ?? []} currentApp="drive" action={
        <MenuButton
          className="drive-create"
          density="comfortable"
          placement="bottom-start"
          label="Create or upload"
          /* Three groups, in the order OneDrive uses and Jonathan asked for
             (2026-10-04): somewhere to put things, ways to bring things in,
             then the things you can make. The separators carry the grouping,
             so the order is the structure. */
          items={creationItems}
          onSelect={chooseCreation}
        >
          <AetherIcon name="plus" />
          <SidebarLabel>Create or upload</SidebarLabel>
        </MenuButton>
      }>
        <nav aria-label="Drive locations">
          {views.map(([id, icon]) => <SidebarRow key={id} item={{id,label:titles[id],icon,current:view === id,onSelect:() => navigate(id)}} />)}
        </nav>
        <SidebarGroup title="Workspaces" storageKey="aether-drive-workspaces-expanded">
          {context?.organizations.map(org => <nav key={org.id} aria-label={`${org.name} workspaces`}>
            {context.organizations.length > 1 && <div className="library-section-title"><SidebarLabel>{org.name}</SidebarLabel></div>}
            {context.workspaces.filter(item => item.organization === org.id)
              .sort((a,b) => Number(!!b.is_default) - Number(!!a.is_default) || a.name.localeCompare(b.name))
              .map(item => <SidebarRow key={item.id} item={{
                id:item.id, label:item.name, current:view === 'workspace' && workspace === item.id,
                icon:(item as typeof item & {icon?:string}).icon
                  ? <AetherIcon name={(item as typeof item & {icon:string}).icon as AetherIconName}/>
                  : <WorkspaceIcon name={item.name}/>,
                onSelect:() => navigate('workspace',item.id),
                onContextMenu:event => {
                  event.preventDefault(); event.stopPropagation(); setRowMenu(null); setBackgroundMenu(null);
                  setWorkspaceMenu({x:event.clientX,y:event.clientY,workspace:item});
                },
              }} />)}
          </nav>)}
        </SidebarGroup>
        <div className="library-nav-spacer" />
      </ApplicationSidebar>
      <main
        className="library-main drive-main"
        aria-label="Aether Drive files"
        onContextMenu={event => {
          if ((event.target as Element).closest('input, textarea, button, a, [role="menu"]')) return;
          event.preventDefault(); event.stopPropagation();
          setRowMenu(null); setWorkspaceMenu(null);
          setBackgroundMenu({x: event.clientX, y: event.clientY});
        }}
        data-dropping={dragDepth > 0 && canUploadHere || undefined}
        onDragEnter={(e) => { if (isFileDrag(e)) { e.preventDefault(); setDragDepth((d) => d + 1); } }}
        onDragOver={(e) => { if (isFileDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = canUploadHere ? "copy" : "none"; } }}
        onDragLeave={(e) => { if (isFileDrag(e)) setDragDepth((d) => Math.max(0, d - 1)); }}
        onDrop={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          setDragDepth(0);
          if (!canUploadHere) return;
          // A dropped folder arrives as entries, not files; webkitGetAsEntry
          // is what distinguishes them, and the file input already covers the
          // folder case, so this reports rather than silently uploading one file.
          const items = Array.from(e.dataTransfer.items ?? []);
          const hasDirectory = items.some((item) => item.webkitGetAsEntry?.()?.isDirectory);
          const files = Array.from(e.dataTransfer.files);
          if (hasDirectory) setNotice("Drop files here, or use Create or upload → Upload folder for a whole folder.");
          if (files.length) void run(() => upload(files));
        }}
      >
        {dragDepth > 0 && canUploadHere && (
          <div className="drive-dropzone" aria-hidden="true">
            <AetherIcon name="import" />
            <strong>Drop to upload</strong>
            <span>to {path.at(-1)?.name ?? "My files"}</span>
          </div>
        )}
              <input
                ref={folderInput}
                type="file"
                {...{ webkitdirectory: "" }}
                multiple
                hidden
                aria-label="Upload folder contents"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (list.length) void run(() => upload(list));
                }}
              />
              <input
                ref={input}
                type="file"
                multiple
                hidden
                aria-label="Upload files"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (list.length) void run(() => upload(list));
                }}
              />
        {view === "home" && !query && (
          <div className="drive-welcome">
            <ApplicationWelcome
              id="drive-welcome"
              updates={DRIVE_UPDATES}
              name="Aether Drive"
              description="Every project. Every file. One place to create, share, and keep your team moving."
              artwork={<ApplicationArtwork app="drive" />}
              wideArtwork={<ApplicationHeroArtwork app="drive" />}
            />
          </div>
        )}
        {view === "workspaces" && context && <DriveWorkspaces key={organization}
          organizations={context.organizations} workspaces={context.workspaces}
          query={query} onOpen={w => navigate("workspace", w.id)}
          onFavorite={async (w, favorite) => {
            const result = await driveRequest<{workspaces: DriveContext["workspaces"]}>("workspace_favorite", {workspace: w.id, favorite});
            setContext(previous => previous ? {...previous, workspaces: result.workspaces} : previous);
          }} />}
        {view !== "workspaces" && <ApplicationListHeading>
            {query
              ? "Search results"
              : view === "workspace"
                ? (context?.workspaces.find((w) => w.id === workspace)?.name ??
                  "Shared workspace")
                : view === "home" ? "Recent" : titles[view]}
        </ApplicationListHeading>}
        {uploadProgress && (
          <div className="drive-upload-progress" role="status">
            <span>
              {uploadProgress.name} · {uploadProgress.percent}%
            </span>
            <progress value={uploadProgress.percent} max="100" />
            <Button
              onClick={() => {
                cancelUpload.current = true;
              }}
            >
              Cancel upload
            </Button>
          </div>
        )}
        {error && (
          <p className="drive-error" role="alert">
            {error}
          </p>
        )}
        {listingError && <p className="drive-error" role="alert">
          Couldn’t load files. {listingError}{" "}
          <Button onClick={() => {
            if (context) void load();
            else {
              setLoadingFiles(true);
              setListingError("");
              void loadContext().catch(e => { setListingError(e.message); setLoadingFiles(false); });
            }
          }}>Try again</Button>
        </p>}
        {notice && (
          <p role="status">
            {notice}
            <IconButton
              label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <AetherIcon name="close" />
            </IconButton>
          </p>
        )}
        {view !== "activity" && view !== "workspaces" && (
          <>
            {recycle && <div className="drive-recovery-actions">
              <DriveRecycleToolbar organization="all" disabled={busy} onChanged={async () => {setSelected(new Set()); await load();}} />
              {current.length > 0 && <>
                      <Button
                        disabled={busy || current.some((f) => !f.manageable)}
                        onClick={() =>
                          void run(async () => {
                            for (const f of current)
                              await driveRequest("restore", { id: f.id, expected_structure_revision: f.structure_revision });
                            setSelected(new Set());
                          })
                        }
                      >
                        <AetherIcon name="restore" /> Restore
                      </Button>
                      <Button
                        disabled={busy || current.some((f) => !f.manageable)}
                        onClick={() => setConfirm("delete_forever")}
                      >
                        <AetherIcon name="delete" /> Delete permanently
                      </Button>
                    </>}
            </div>}
            {(fileBrowser || parent) && (
              <div className="drive-address">
                <Breadcrumbs ariaLabel="Folder path" items={query ? [
                  {id: "root", label: "My files"},
                  {id: "search", label: "Search results"},
                ] : [
                  ...(view === "workspace" && !activeWorkspace?.is_default ? [{id: "organization", label: org?.name ?? "Organization"}] : []),
                  {id: "root", label: view === "workspace"
                    ? context?.workspaces.find(ws => ws.id === workspace)?.name ?? "Workspace"
                    : view === "shared" ? "Shared" : "My files"},
                  ...(parent ? path.map(p => ({id: `folder:${p.id}`, label: p.name})) : []),
                ]} onNavigate={id => {
                  if (id === "organization") {
                    const root = context?.workspaces.find(w => w.organization === organization && w.is_default);
                    if (root) navigate("workspace", root.id); else navigate("workspaces");
                    return;
                  }
                  setParent(id === "root" ? null : id.slice("folder:".length));
                  setQuery("");
                  setNameFilter("");
                  setSelected(new Set());
                  setError("");
                  if (id === "root") setPath([]);
                }} />
              </div>
            )}
            <DriveListControls direction={view === "shared" ? sharedScope : undefined} onDirection={direction => {
              setSharedScope(direction); setParent(null); setSelected(new Set()); setFiles([]); setPath([]); setError("");
            }} type={type} onType={setType} filter={nameFilter} onFilter={setNameFilter}>{fileTools}</DriveListControls>
            <div className="library-listing drive-content">
              <div
                className="library-listing-main"
                aria-busy={busy || loadingFiles}
              >
                {loadingFiles && !shown.length && <p role="status">Loading files…</p>}
                {!grid && tableRows.length > 0 && <ApplicationFileTable
                  label="Drive files"
                  compact={false}
                  sort={{id: sort, ascending: sortAsc}}
                  onSort={id => { if (id === sort) setSortAsc(!sortAsc); else { setSort(id); setSortAsc(true); } }}
                  columns={[
                    {id: "type", label: "Type", sortable: true, render: f => f.entry ? "Workspace" : fileTypeFor(f.file!).label},
                    {id: recycle ? "deleted_at" : view === "shared" ? "shared_at" : view === "home" || view === "recent" ? "opened" : "modified",
                      label: recycle ? "Deleted" : view === "shared" ? "Date shared" : view === "home" || view === "recent" ? "Opened" : "Modified", sortable: true,
                      render: row => { if (!row.file) return "—"; const f = row.file; const date = recycle ? f.deleted_at : view === "shared" ? f.shared_at : (view === "home" || view === "recent" ? f.opened : undefined) ?? f.modified;
                        return date ? <span title={new Date(date * 1000).toLocaleString()}>{new Date(date * 1000).toLocaleDateString()}</span> : "—"; }},
                    {id: "owner", label: "Owner", sortable: true, render: f => f.owner},
                    ...(fileBrowser || recycle ? [{id: "size", label: "File size", sortable: true, secondary: true, render: (f: typeof tableRows[number]) => !f.file || f.file.kind === "folder" ? "—" : bytes(f.file.size)}] : []),
                    ...(view === "shared" ? [{id: "shared_by", label: "Shared by", sortable: true, secondary: true, render: (f: typeof tableRows[number]) => f.file?.shared_by ?? "—"}] : []),
                    ...(recycle ? [{id: "deleted_by", label: "Deleted by", sortable: true, secondary: true, render: (f: typeof tableRows[number]) => f.file?.deleted_by ?? "—"}] : []),
                    ...(fileBrowser ? [{id: "sharing", label: "Sharing", sortable: true, secondary: true, render: (f: typeof tableRows[number]) => f.entry ? "Workspace" : f.file?.sharing ?? "—"}] : []),
                  ]}
                  dateLabel={view === "home" || view === "recent" ? "Opened" : "Modified"}
                  rows={tableRows}
                  selectedIds={selected}
                  onSelect={selectFile}
                  onOpen={row => { if (row.entry) navigate("workspace", row.entry.id); else if (row.file && view !== "trash") void run(() => open(row.file!)); }}
                  onContextMenu={(row, event) => {
                    event.preventDefault(); event.stopPropagation();
                    if (row.entry) { setRowMenu(null); setBackgroundMenu(null); setWorkspaceMenu({workspace: row.entry, x:event.clientX, y:event.clientY}); return; }
                    const f = row.file!;
                    setBackgroundMenu(null); setWorkspaceMenu(null);
                    if (!selected.has(f.id)) setSelected(new Set([f.id]));
                    setRowMenu({ file: f, x: event.clientX, y: event.clientY });
                  }}
                  onToggle={(row, checked) => { if (row.file) toggleFile(row.file, checked); else setSelected(previous => {const next = new Set(previous); if (checked) next.add(row.id); else next.delete(row.id); return next;}); }}
                  onSelectAll={checked => setSelected(checked ? new Set(tableRows.map(f => f.id)) : new Set())}
                  renderActions={row => { if (row.entry) return <IconButton label={`Actions for workspace ${row.name}`} onClick={event => {const bounds = event.currentTarget.getBoundingClientRect(); setWorkspaceMenu({workspace:row.entry!,x:bounds.left,y:bounds.bottom});}}><AetherIcon name="more" /></IconButton>; const f = row.file!; return view === "trash" ? (
                    <IconButton label={`Restore ${f.name}`} disabled={!f.manageable || busy}
                      onClick={() => void run(() => driveRequest("restore", { id: f.id, expected_structure_revision: f.structure_revision }))}>
                      <AetherIcon name="restore" />
                    </IconButton>
                  ) : (
                    <MenuButton label={`Actions for ${f.name}`} items={actions(f)} onSelect={id => choose(id, f)}>
                      <AetherIcon name="more" />
                    </MenuButton>
                  ); }}
                />}
                {grid && <div className="drive-file-grid">
                {directoryRows.map(entry => <div className="drive-file-row" key={`workspace:${entry.id}`} onContextMenu={event => {event.preventDefault(); event.stopPropagation(); setBackgroundMenu(null); setRowMenu(null); setWorkspaceMenu({workspace:entry,x:event.clientX,y:event.clientY});}}>
                  <button className="drive-file-name" onClick={() => navigate("workspace", entry.id)}><FileIcon file={{name:entry.name,kind:"folder"}} size={28} /><span><strong>{entry.name}</strong><small>Workspace</small></span></button>
                </div>)}
                {shown.map((f) => (
                  <div
                    key={f.id}
                    className="drive-file-row"
                    onContextMenu={event => {
                      event.preventDefault(); event.stopPropagation();
                      setBackgroundMenu(null); setWorkspaceMenu(null);
                      if (!selected.has(f.id)) setSelected(new Set([f.id]));
                      setRowMenu({file: f, x: event.clientX, y: event.clientY});
                    }}
                    data-selected={selected.has(f.id) || undefined}
                    onDoubleClick={event => {
                      if ((event.target as Element).closest("input, button:not(.drive-file-name)")) return;
                      if (view !== "trash") void run(() => open(f));
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${f.name}`}
                      checked={selected.has(f.id)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(f.id);
                          else next.delete(f.id);
                          return next;
                        })
                      }
                    />
                    <button
                      className="drive-file-name"
                      onKeyDown={event => {
                        if (event.key === "Enter" && view !== "trash") {event.preventDefault(); void run(() => open(f));}
                      }}
                      onClick={event => selectFile(f, event)}
                    >
                      <FileIcon file={f} size={48} />
                      <span>
                        <strong>{f.name}</strong>
                        <small>
                          {recycle ? f.original_location ?? "—" : fileType(f)}
                          {f.versions
                            ? ` · ${f.versions} named version${f.versions === 1 ? "" : "s"}`
                            : ""}
                          {f.favorite ? " · Favorite" : ""}
                        </small>
                      </span>
                    </button>
                    <span className="drive-date">
                      {recycle ? f.deleted_at ? new Date(f.deleted_at * 1000).toLocaleDateString() : "—" : new Date(f.modified * 1000).toLocaleDateString()}
                    </span>
                    <span className="drive-owner">{recycle ? f.deleted_by ?? "—" : f.owner}</span>
                    <span className="drive-size">
                      {f.kind === "folder" ? "—" : bytes(f.size)}
                    </span>
                    {view === "trash" ? (
                      <IconButton
                        label={`Restore ${f.name}`}
                        disabled={!f.manageable || busy}
                        onClick={() =>
                          void run(() => driveRequest("restore", { id: f.id, expected_structure_revision: f.structure_revision }))
                        }
                      >
                        <AetherIcon name="restore" />
                      </IconButton>
                    ) : (
                      <MenuButton
                        label={`Actions for ${f.name}`}
                        items={actions(f)}
                        onSelect={(id) => choose(id, f)}
                      >
                        <AetherIcon name="more" />
                      </MenuButton>
                    )}
                  </div>
                ))}
                </div>}
                {!shown.length && !directoryRows.length && !loadingFiles && !listingError && (
                  <div className="drive-empty">
                    <AetherIcon name={view === "trash" ? "delete" : "folder"} />
                    <h2>
                      {query || (!fileBrowser && !recycle && (nameFilter || type !== "all"))
                        ? "No matching files"
                        : recycle ? "Your recycle bin is empty" : view === "home"
                          ? "Your recent work will appear here"
                          : view === "shared" ? sharedScope === "with" ? "No files shared with you yet" : "You haven’t shared any files yet" : "This location is empty"}
                    </h2>
                    <p>
                      {query || (!fileBrowser && !recycle && (nameFilter || type !== "all"))
                        ? "Try another name or file type."
                        : view === "trash"
                          ? "Deleted files remain here until you restore or permanently delete them."
                          : view === "shared" ? sharedScope === "with" ? "Files shared by your team will appear here." : "Share a file or folder from My files to see it here." : "Create a document or upload files to get started."}
                    </p>
                  </div>
                )}
              </div>
              {details && (
                <aside className="drive-details studio-file-inspector" aria-label="File details">
                  {file ? (
                    <FileDetails
                      name={file.name}
                      icon={<FileIcon file={file} size={48} />}
                      subtitle={fileType(file)}
                      previewURL={`/api/drive/download?id=${encodeURIComponent(file.id)}&preview=1`}
                      previewKind={file.kind === "folder" ? "none" : previewKind(file.name)}
                      onPreview={file.kind !== "folder" && canPreview(file.name) ? () => setPreview(file) : undefined}
                      access={fileDetail.id === file.id ? fileDetail.access : undefined}
                      accessNote={
                        file.manageable
                          ? fileDetail.id === file.id && fileDetail.access?.length === 0
                            ? file.sharing === "Workspace"
                              ? "Everyone in this workspace can open it."
                              : "Only you."
                            : undefined
                          : `Shared with you · ${file.role} access`
                      }
                      onManageAccess={file.manageable ? () => setShare(file) : undefined}
                      activity={fileDetail.id === file.id ? fileDetail.activity : undefined}
                      information={[
                        { label: "Type", value: fileType(file) },
                        file.kind === "folder"
                          ? { label: "Items", value: file.child_count ?? "—" }
                          : { label: "Size", value: bytes(file.size) },
                        { label: "Owner", value: file.owner },
                        { label: "Modified", value: new Date(file.modified * 1000).toLocaleString() },
                        ...(file.modified_by ? [{ label: "Modified by", value: file.modified_by }] : []),
                        ...(file.kind === "file" ? [{ label: "Versions", value: file.versions }] : []),
                        { label: "Your access", value: file.role },
                      ]}
                    />
                  ) : (
                    <Inspector><p>Select a file to see its details.</p></Inspector>
                  )}
                </aside>
              )}
            </div>
          </>
        )}
        {view === "activity" && (
          <ol className="drive-activity">
            {events.map((event) => (
              <li key={event.id}>
                <AetherIcon name="history" />
                <div>
                  <strong>{event.detail || event.action}</strong>
                  <p>
                    {event.action.replaceAll("_", " ")} · {event.author} ·{" "}
                    {new Date(event.created * 1000).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
            {!events.length && <p>No activity yet.</p>}
          </ol>
        )}
      </main>
      <DriveSettings open={settings} onClose={() => setSettings(false)} onSync={() => { setSettings(false); setSync(true); }} />
      {sync && (
        <Dialog
          open
          title="Desktop sync"
          onClose={() => setSync(false)}
          actions={<Button onClick={() => setSync(false)}>Done</Button>}
        >
          <p>
            Sync a local folder with this Drive location. Files are downloaded
            for offline editing; changes sync while the companion is running.
          </p>
          <p>
            Run from your Aether Studio installation, choosing an empty local
            folder:
          </p>
          <pre className="drive-sync-command">
            {[
              "python3 -m core.host.drive_sync",
              "--url " + shellQuote(location.origin),
              "--username " + shellQuote(context?.user.username),
              "--organization " + shellQuote(organization),
              ...(dest.workspace
                ? ["--workspace " + shellQuote(dest.workspace)]
                : []),
              ...(parent ? ["--remote-folder " + shellQuote(parent)] : []),
              '--folder "/path/to/your/sync-folder" --watch',
            ].join(" \\\n")}
          </pre>
          <p>
            Enter your Studio password when prompted. Sync preserves conflicting
            edits as separate files and sends deletions to the recycle bin. Stop
            the companion with Ctrl-C.
          </p>
          <p>
            This companion requires Python and an Aether Studio installation.
            Native Files On-Demand placeholders are not available yet.
          </p>
        </Dialog>
      )}
      {workspaceMenu && <Menu open anchor={workspaceMenu} ariaLabel={`Actions for workspace ${workspaceMenu.workspace.name}`} applicationCommands={false}
        items={[
          {id:'open',label:'Open workspace',icon:<AetherIcon name="folder"/>},
          {id:'favorite',label:workspaceMenu.workspace.favorite ? 'Remove from favorites' : 'Add to favorites',icon:<AetherIcon name="star"/>,separatorBefore:true},
        ]} onClose={() => setWorkspaceMenu(null)} onSelect={id => {
          const item = workspaceMenu.workspace; setWorkspaceMenu(null);
          if (id === 'open') navigate('workspace',item.id);
          else void run(async () => {
            const result = await driveRequest<{workspaces:DriveContext['workspaces']}>('workspace_favorite',{workspace:item.id,favorite:!item.favorite});
            setContext(previous => previous ? {...previous,workspaces:result.workspaces} : previous);
          });
        }} />}
      {backgroundMenu && <Menu open anchor={backgroundMenu} ariaLabel="File area actions" applicationCommands={false}
        items={driveBackgroundMenu({creation: creationItems, canCreate: canUploadHere && !busy, grid, details, selected: selected.size, count: tableRows.length, busy, sort, ascending:sortAsc})}
        onClose={() => setBackgroundMenu(null)} onSelect={id => {
          setBackgroundMenu(null);
          if (id === "refresh") void run(load);
          else if (id === "select-all") setSelected(new Set(tableRows.map(f => f.id)));
          else if (id === "clear-selection") setSelected(new Set());
          else if (id === "view-list" || id === "view-grid") setGrid(id === "view-grid");
          else if (id === "details") setDetails(!details);
          else if (id.startsWith("sort:")) setSort(id.slice(5));
          else if (id.startsWith("order:")) setSortAsc(id === "order:ascending");
          else chooseCreation(id);
        }} />}
      {rowMenu && (
        <Menu
          open
          className="aui-collection-popup"
          anchor={{ x: rowMenu.x, y: rowMenu.y }}
          ariaLabel={current.length > 1 ? `Actions for ${current.length} selected files` : `Actions for ${rowMenu.file.name}`}
          applicationCommands={false}
          items={current.length > 1 ? bulkActions : actions(rowMenu.file)}
          onClose={() => setRowMenu(null)}
          onSelect={(id) => { const file = rowMenu.file; setRowMenu(null); choose(id, file); }}
        />
      )}
      {preview && !(preview.mime.startsWith("text/") || /\.(json|md|yaml|csv)$/i.test(preview.name)) && (
        <FilePreview
          name={preview.name}
          url={`/api/drive/download?id=${encodeURIComponent(preview.id)}`}
          detail={`${preview.owner} · ${bytes(preview.size)}`}
          onClose={() => setPreview(null)}
          onOpen={preview.kind === "folder" ? undefined : () => { const file = preview; setPreview(null); void run(() => open(file)); }}
          onDownload={() => void run(() => download(preview))}
          onPrevious={previewNeighbour(-1) ? () => setPreview(previewNeighbour(-1)) : undefined}
          onNext={previewNeighbour(1) ? () => setPreview(previewNeighbour(1)) : undefined}
        />
      )}
      {creatingNative && <NewFileDialog title={`New ${creatingNative.kind}`} directory={path.at(-1)?.name ?? context?.workspaces.find(w => w.id === dest.workspace)?.name ?? 'My files'}
        onClose={() => setCreatingNative(null)} onCreate={async name => {
          const created = await createNativeFile<{id: string; name: string}>(creatingNative.app, creatingNative.kind, name, dest, 'drive');
          const nextView = dest.workspace ? 'workspace' : 'personal';
          setType('all'); setNameFilter(''); setSelected(new Set([created.id]));
          setNotice(`Created ${created.name}`);
          if (view !== nextView || query) { setView(nextView); setWorkspace(dest.workspace); setQuery(''); }
          else await load();
        }} />}
      {form && (
        <Dialog
          open
          title={
            {
              folder: "New folder",
              rename: "Rename file",
              text: "New text document",
            }[form]
          }
          onClose={() => {
            if (!busy) setForm(null);
          }}
          actions={
            <>
              <Button disabled={busy} onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button
                primary
                disabled={busy || !name.trim()}
                onClick={() =>
                  void run(async () => {
                    if (form === "rename" && file)
                      await driveRequest("rename", {
                        id: file.id,
                        name,
                        expected_revision: file.revision,
                        kind: file.kind,
                      });
                    else
                      await driveRequest("create", {
                        ...dest,
                        app: "drive",
                        name,
                        kind: form === "folder" ? "folder" : "file",
                        data_base64: form === "folder" ? "" : await encodeFile(new File([text], name)),
                      });
                    if (view === "workspaces" && (form === "folder" || form === "text")) navigate("personal");
                    setForm(null);
                  })
                }
              >
                {form === "rename" ? "Save" : "Create"}
              </Button>
            </>
          }
        >
          <label>
            Name
            <input
              aria-label="Name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {form === "text" && (
            <label>
              Contents
              <textarea
                aria-label="Text contents"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
          )}
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
      {share && (
        <DriveShare
          file={share}
          onClose={() => {
            setShare(null);
            void load();
          }}
        />
      )}
      {preview && (preview.mime.startsWith("text/") || /\.(json|md|yaml|csv)$/i.test(preview.name)) && (
        <DrivePreview key={preview.id} file={preview} onClose={() => setPreview(null)} />
      )}
      {move && context && (
        <DriveMove
          files={current}
          context={context}
          organization={organization}
          copy={move === "copy"}
          onClose={() => setMove(null)}
          onDone={() => {
            setSelected(new Set());
            void load();
          }}
        />
      )}
      {documentTab && file && (
        <DriveDocument
          file={file}
          tab={documentTab}
          onClose={() => {
            setDocumentTab(null);
            void load();
          }}
        />
      )}
      {confirm && (
        <Dialog
          open
          title={
            confirm === "trash" ? "Move to recycle bin?" : "Delete permanently?"
          }
          onClose={() => setConfirm(null)}
          actions={
            <>
              <Button disabled={busy} onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button
                disabled={busy}
                primary
                onClick={() =>
                  void run(async () => {
                    if (confirm === "delete_forever") await driveRequest("empty_trash", {organization: "all", ids: current.map(f => f.id)});
                    else for (const f of current) await driveRequest(confirm, { id: f.id, expected_structure_revision: f.structure_revision });
                    setSelected(new Set());
                    setConfirm(null);
                  })
                }
              >
                {confirm === "trash"
                  ? "Move to recycle bin"
                  : "Delete permanently"}
              </Button>
            </>
          }
        >
          <p>
            {current.length} selected item(s)
            {confirm === "delete_forever"
              ? " and their contents will be permanently deleted."
              : " will be moved to the recycle bin. You can restore them later."}
          </p>
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
    </ApplicationHomeFrame>
    </div>
  );
}
