import { PluginWindow, PluginsIcon } from "./PluginWindow";
import "./library-embedded.css";
import { FileObjectPreview } from "./FileObjectPreview";
import { LibrarySettings } from "./LibrarySettings";
import { readLibraryPreferences, writeLibraryPreferences, type LibraryPreferences } from "./library-preferences";
import { APP_UPDATES } from "./app-updates";
import { CADWhatsNew } from "./CADWhatsNew";
import { Inspector } from "@aether/ui";
import { FileDetails } from "@aether/ui/file-details";
import "@aether/session/library/FileDetailsInspector.css";
import "./LibraryFileControls.css";
import {ListToolMenu as ToolMenu} from "@aether/ui";
import {CreateMenu, type CreateChoice} from "./CreateMenu";
import { DocumentHistory } from "./DocumentHistory";
import { NewFileDialog } from "@aether/ui";
import { NewDesignDialog } from "@aether/ui/new-design";
import { CAD_DESIGN_KINDS as DESIGN_KINDS, DESIGN_UNIT_OPTIONS } from "@aether/session/library/design-kinds";
import { createNativeFile } from "@aether/session/library/create-native-file";
import { useEffect, useRef, useState } from "react";
import { ApplicationListHeading, ApplicationListControls, Breadcrumbs, WorkspaceIcon, FileIcon, fileTypeFor, ApplicationFileTable, ApplicationSidebar, SidebarNavigation, AppIcon, ApplicationHomeFrame, ApplicationHomeHeader, AetherIcon, Button, IconButton, Menu, TextField , type AetherIconName, type LaunchableApp } from "@aether/ui";
import { api } from "@aether/session/library/api";
import { driveRequest, type DriveContext } from "@aether/session/library/drive-api";
import { useLibraryListing } from "./use-library-listing";
import { ApplicationWelcome } from "@aether/ui";
import { ApplicationArtwork, ApplicationHeroArtwork } from "@aether/session/library/ApplicationArtwork";
import "@aether/session/library/library.css";

type Entry = {
  organization: string;
  workspace: string | null;
  id: string;
  name: string;
  kind: "file" | "folder";
  scope: string;
  parent: string | null;
  owner: string;
  writable: boolean;
  revision: number;
  modified: number;
  size: number;
  data_base64?: string;
};
type View = "home" | "personal" | "recent" | "workspace" | "shared" | "trash";


import { LIBRARY_APPS, type LibraryAppID } from "./library-apps";


const titles = {
  home: "Home",
  personal: "My files",
  recent: "Recently opened",
  workspace: "Workspace",
  shared: "Shared",
  trash: "Recycle bin",
};
const DETAILS_KEY = (app: string) => `aether-library-details-${app}`;

/** Storage can be unavailable (private window, blocked site data); the
 *  default of "closed" is the right answer when it is. */
function readDetailsPreference(app: string): boolean {
  try {
    return localStorage.getItem(DETAILS_KEY(app)) === "open";
  } catch {
    return false;
  }
}

function writeDetailsPreference(app: string, open: boolean): void {
  try {
    localStorage.setItem(DETAILS_KEY(app), open ? "open" : "closed");
  } catch {
    // A device preference only; never worth failing an interaction over.
  }
}


export function LibraryHome({ workspace: workspaceLabel, app = "cad" }: { workspace: string; app?: LibraryAppID }) {
  const cfg = LIBRARY_APPS[app];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [directory, setDirectory] = useState<DriveContext | null>(null);
  const [workspaceID, setWorkspaceID] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState("");
  useEffect(() => {
    let live = true;
    void driveRequest<DriveContext>("context").then(context => {
      if (!live) return;
      setDirectory(context);
      setWorkspaceID(context.workspaces.find(item => item.organization === "default" && item.is_default)?.id ?? context.workspaces[0]?.id ?? null);
    }).catch(error => { if (live) setDirectoryError(error.message); });
    return () => { live = false; };
  }, []);
  const activeWorkspace = directory?.workspaces.find(item => item.id === workspaceID);
  const workspace = activeWorkspace?.name ?? workspaceLabel;

  useEffect(() => { document.title = cfg.brand; }, [cfg.brand]);
  const [preferences, setPreferences] = useState(() => readLibraryPreferences(app));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [canManagePlugins, setCanManagePlugins] = useState(false);
  const updatePreferences = (value: LibraryPreferences) => {
    try { writeLibraryPreferences(app, value); setPreferences(value); setDesignUnits(value.lengthUnit); }
    catch { setError("Your browser could not save these preferences."); }
  };
  const typeOf = (file: { kind: string; name: string }) => file.kind === "folder" ? "folder" : (cfg.types.find((type) => type.test.test(file.name.toLowerCase()))?.id ?? "import");
  const embedded = window.parent !== window && new URLSearchParams(location.search).get("embedded") === "1";
  useEffect(() => {
    if (!embedded) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector('[role="dialog"], [role="menu"]')) window.parent.postMessage({type:"aether-cad-close-library"}, location.origin);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [embedded]);
  const [view, setView] = useState<View>(() => embedded ? "personal" : readLibraryPreferences(app).startPage);
  const [apps, setApps] = useState<LaunchableApp[]>([]);
  useEffect(() => {
    void api<{
      user: { full_name?: string; username?: string; role?: string } | null;
      apps?: { id: string; name: string; description?: string; url: string; enabled?: boolean; coming_soon?: boolean }[];
    }>("/api/status").then(
      (status) => {
        setCanManagePlugins(status.user?.role === "admin");
        // The host already decides what this person may open; show that.
        setApps(
          (status.apps ?? [])
            .filter((entry) => entry.enabled !== false)
            .map((entry) => ({
              id: entry.id,
              name: entry.name,
              description: entry.description,
              url: entry.url,
              comingSoon: entry.coming_soon,
            })),
        );
      },
      () => undefined,
    );
  }, []);
  const [folders, setFolders] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [query, setQuery] = useState("");
  const [grid, setGrid] = useState(() => readLibraryPreferences(app).view === "grid");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [nameFilter, setNameFilter] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; file?: Entry; workspace?: DriveContext["workspaces"][number] } | null>(null);
  // Closed until asked for: the list is what the page is for, and the tray
  // takes room from it. The choice is remembered per application, the way the
  // sidebar beside it remembers its own.
  const [showDetails, setShowDetails] = useState(() => readDetailsPreference(app));
  const [sortKey, setSortKey] = useState<"name" | "opened" | "owner">("opened");
  const [sortAsc, setSortAsc] = useState(false);
  const parent = folders.at(-1)?.id ?? null;
  useEffect(()=>setSelectedIds(new Set()),[view,parent]);
  const {files, loading, error: listingError, reload: list} = useLibraryListing<Entry>({app, view, parent, query, location: activeWorkspace ? {organization: activeWorkspace.organization, workspace: activeWorkspace.id} : null});
  const filterText = nameFilter.trim().toLowerCase();
  const compareShown = (a: Entry, b: Entry) => {
    const result =
      sortKey === "name"
        ? a.name.localeCompare(b.name)
        : sortKey === "owner"
          ? a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name)
          : a.modified - b.modified;
    return sortAsc ? result : -result;
  };
  const shown = files.filter((file) => {
    const type = typeOf(file);
    if (typeFilter !== "all" && !(type === typeFilter || (type === "import" && typeFilter === cfg.types[0].id))) return false;
    if (filterText && !file.name.toLowerCase().includes(filterText) && !file.owner.toLowerCase().includes(filterText)) return false;
    return true;
  }).sort(compareShown);
  const childWorkspaces = view === "workspace" && activeWorkspace?.is_default && !parent && !query && typeFilter === "all"
    ? (directory?.workspaces ?? []).filter(w=>w.organization === activeWorkspace.organization && !w.is_default && w.name.toLowerCase().includes(filterText)).sort((a,b)=>a.name.localeCompare(b.name)) : [];
  const tableRows = [
    ...childWorkspaces.map(entry=>({id:`workspace:${entry.id}`,name:entry.name,icon:<FileIcon file={{name:entry.name,kind:"folder"}} size={28}/>,location:"Workspace",date:"—",owner:directory?.organizations.find(o=>o.id===entry.organization)?.name ?? "Organization",file:undefined as Entry|undefined,entry})),
    ...shown.map(file=>({id:file.id,name:file.name,icon:<FileObjectPreview file={file} app={app} enabled={preferences.objectPreviews}/>,location:file.workspace ? directory?.workspaces.find(w=>w.id===file.workspace)?.name ?? "Workspace" : "My files",date:new Date(file.modified*1000).toLocaleDateString(),owner:file.owner,file,entry:undefined as DriveContext["workspaces"][number]|undefined})),
  ];
  const startCreate = (choice: CreateChoice) => {
    if (choice === "design") setChoosingDesign(true);
    else if (choice !== "folder" && choice !== "import") newDocument(choice);
    else if (choice === "import") input.current?.click();
    else {
      setName("");
      setDialog(choice);
    }
  };
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creatingKind, setCreatingKind] = useState<string | null>(null);
  const [choosingDesign, setChoosingDesign] = useState(false);
  /* The unit system the new document starts in. The catalogue is the suite's
     own (core/assets/cad/units.json), so this offers what the engine can
     actually work in rather than a hard-coded list. */
  const [designUnits, setDesignUnits] = useState(() => readLibraryPreferences(app).lengthUnit as string);
  const createdSelection = useRef<string | null>(null);
  // Creation never navigates or clears the user's current search/filter context.
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<
    "folder" | "rename" | null
  >(null);
  const [showHistory, setShowHistory] = useState(false);
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  /* The hero and the Get started cards introduce the app, so they belong on
     Home and nowhere else. They used to follow you into My files as well
     (Jonathan, 2026-10-01: "my folder doesn't need to show the hero, or get
     started widgets"), which pushed the file list below the fold in the one
     view whose whole job is the file list. */
  const showIntro = view === "home";
  useEffect(() => {
    const createdID = createdSelection.current;
    setSelected(current => files.find(file => file.id === createdID) ?? files.find(file => file.id === current?.id) ?? null);
    if (!loading && !listingError) createdSelection.current = null;
  }, [files, loading, listingError]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const navigate = (next: View) => {
    setView(next);
    setFolders([]);
    setQuery("");
    setNameFilter(""); setTypeFilter("all"); setSelected(null); setError(""); setNotice("");
  };
  const visitFolder = (path: Entry[]) => {
    setFolders(path); setQuery(""); setNameFilter(""); setTypeFilter("all");
    setSelected(null); setError("");
  };
  const open = (file: Entry) => {
    if (file.kind === "folder") {
      setView(file.scope === "workspace" ? "workspace" : "personal");
      if (file.workspace) setWorkspaceID(file.workspace);
      visitFolder([...folders, file]);
      return;
    }
    if (embedded) { window.parent.postMessage({type:"aether-cad-open-file",id:file.id}, location.origin); return; }
    location.assign(cfg.appUrl + "?document=" + encodeURIComponent(file.id));
  };
  const scope = view === "workspace" ? "workspace" : view === "home" ? preferences.destination : "personal";
  const destination = () => {
    if (scope === "workspace" && !activeWorkspace) throw new Error("Choose an available organization workspace first.");
    return {scope, parent, ...(scope === "workspace" ? {organization: activeWorkspace!.organization, workspace: activeWorkspace!.id} : {organization: folders.at(-1)?.organization ?? "default", workspace: null})};
  };
  const upload = async (file: File) => {
    if (!cfg.uploadPattern.test(file.name))
      throw new Error(
        cfg.uploadHint,
      );
    if (file.size > 6 * 1024 * 1024)
      throw new Error("Choose a file up to 6 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768)
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const created = await api<Entry>("/api/library/create", {
      app,
      name: file.name,
      ...destination(),
      data_base64: btoa(binary),
    });
    await refreshCreated(created, "Uploaded");
  };
  const refreshCreated = async (created: Entry, action = "Created", extra = "") => {
    const where = folders.at(-1)?.name ?? (scope === "workspace" ? workspace : "My files");
    setNotice(`${action} ${created.name} in ${where}. Your current view is unchanged. Open it when you are ready.${extra}`);
    createdSelection.current = created.id;
    await list();
  };
  const edit = async () => {
    if (dialog === "folder") {
      const created = await api<Entry>("/api/library/create", {
        app,
        name,
        kind: "folder",
        ...destination(),
      });
      setDialog(null);
      await refreshCreated(created);
      return;
    } else if (selected)
      await api("/api/library/rename", {
        app,
        id: selected.id,
        name,
        expected_revision: selected.revision,
      });
    setDialog(null);
    await list();
  };
  const share = () =>
    run(async () => {
      if (!selected) return;
      await api("/api/library/share", {
        app,
        id: selected.id,
        scope: selected.scope === "personal" ? "workspace" : "personal",
        expected_revision: selected.revision,
      });
      await list();
    });
  const download = () =>
    run(async () => {
      if (!selected) return;
      const file = await api<Entry>("/api/library/read", {
        app,
        id: selected.id,
      });
      const bytes = Uint8Array.from(atob(file.data_base64!), (c) =>
        c.charCodeAt(0),
      );
      const url = URL.createObjectURL(new Blob([bytes]));
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  const newDocument = (kind: string) => setCreatingKind(kind);
  return (
    <div style={{display:"contents"}} onContextMenu={event=>{
      const target=event.target as Element;
      // The application fallback prevents default during capture. It does not
      // own this event: home navigation still supplies the library menu.
      if (target.closest('input,textarea,[contenteditable="true"],[role="dialog"],[role="menu"]')) return;
      event.preventDefault();event.stopPropagation();setMenu({x:event.clientX,y:event.clientY});
    }}>
    <ApplicationHomeFrame design={embedded ? "standard" : "studio"} className={`studio library-root${embedded ? " library-embedded" : ""}`} layout="header">
      {pluginsOpen && <PluginWindow app={app} canManage={canManagePlugins} onClose={() => setPluginsOpen(false)}/>}
      {<LibrarySettings app={app} open={settingsOpen} name={cfg.brand} workspace={workspace} preferences={preferences} onChange={updatePreferences} onClose={() => setSettingsOpen(false)} />}
      {choosingDesign && (
        <NewDesignDialog
          kinds={DESIGN_KINDS}
          defaultKindID={preferences.designKind}
          learnMoreHref="https://github.com/aether-studio"
          units={{ label: "Unit System", value: designUnits, onChange: setDesignUnits,
            options: DESIGN_UNIT_OPTIONS }}
          onClose={() => setChoosingDesign(false)}
          onCreate={(kind) => { setChoosingDesign(false); newDocument(kind); }}
        />
      )}
      {creatingKind && <NewFileDialog title={`New ${app === "cad" ? DESIGN_KINDS.find(kind => kind.id === creatingKind)?.title ?? creatingKind : creatingKind}`} directory={folders.at(-1)?.name ?? (scope === "workspace" ? workspace : "My files")}
        onClose={() => setCreatingKind(null)} onCreate={async name => {
          const created = await createNativeFile<Entry>(app, creatingKind, name, destination());
          let unitsWarning = "";
          if (app === "cad") {
            try {
              const meta = await api<{revision:number; settings:{units:Record<string, {unit:string;decimals:number}>}}>("/api/library/cad_metadata", {app, id:created.id});
              await api("/api/library/cad_operation", {app, id:created.id, expected_revision:meta.revision, operation:"units", units:{...meta.settings.units, length:{unit:designUnits, decimals:preferences.decimals}, angle:{unit:preferences.angleUnit, decimals:preferences.decimals}}});
            } catch { unitsWarning = " Default units could not be applied. Set Workspace units after opening this file."; }
          }
          await refreshCreated(created, "Created", unitsWarning);
        }} />}
      <ApplicationHomeHeader design="studio" app={app} name={cfg.brand} apps={apps} className="library-top" onSettings={() => setSettingsOpen(true)} identity={!embedded} search={
        <TextField aria-label={"Search " + cfg.brand + " files"} placeholder="Search files and folders"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      } />
      <input
        ref={input}
        type="file"
        hidden
        accept={cfg.accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void run(() => upload(file));
          e.target.value = "";
        }}
      />
      {!embedded && <ApplicationSidebar id={`${app}-library`} name={cfg.brand} userLabel={directory?.user.name || directory?.user.username || "My files"} icon={<AppIcon app={app} size={32} />} homeUrl={`/${app}/`} brand={false} footer={<></>} settings={embedded ? undefined : true} apps={embedded ? undefined : apps} currentApp={app}
        footerTools={embedded ? null : <SidebarNavigation ariaLabel="Plugins" sections={[{id:"plugins",items:[{id:"plugins",label:"Plugins",icon:<PluginsIcon/>,onSelect:() => setPluginsOpen(true)}]}]} />}
        action={<CreateMenu disabled={busy} onChoose={startCreate} items={cfg.menu}/>}
        sections={[
          { id: "library", items: (["home", "personal", "shared", "trash"] as View[]).map((id) => ({
            id, label: titles[id], current: view === id, onSelect: () => navigate(id),
            icon: (id === "home" ? "home" : id === "shared" ? "link" : id === "trash" ? "delete" : "folder") as AetherIconName,
          })) },
          ...(directory?.organizations ?? []).map(organization => ({
            id: organization.id, title: organization.name,
            items: (directory?.workspaces ?? []).filter(item => item.organization === organization.id).map(item => ({
              id: item.id, label: item.name, current: view === "workspace" && workspaceID === item.id,
              onSelect: () => { setWorkspaceID(item.id); navigate("workspace"); }, icon: <WorkspaceIcon name={item.name}/>,
            })),
          })),
        ]} />}
      <main
        className="library-main"
        onContextMenu={(e) => {
          e.preventDefault(); e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {embedded && <div className="library-embedded-toolbar">
          <div role="group" aria-label="File location"><Button aria-pressed={view === "personal"} onClick={() => navigate("personal")}>My files</Button><Button aria-pressed={view === "workspace"} onClick={() => navigate("workspace")}>{workspace}</Button></div>
          <CreateMenu disabled={busy} onChoose={startCreate} items={cfg.menu}/>
        </div>}
        {menu && (
          <Menu
            open
            ariaLabel="Library actions"
            anchor={{ x: menu.x, y: menu.y }}
            onClose={() => setMenu(null)}
            onSelect={(id) => {
              const target = menu.file;
              if (id === "open-workspace" && menu.workspace) {setWorkspaceID(menu.workspace.id);navigate("workspace");}
              setMenu(null);
              if (id === "open" && target) open(target);
              else if (id === "details" && target) {
                setSelected(target); setShowDetails(true); writeDetailsPreference(app, true);
              }
              else if (id === "rename" && target) {setName(target.name);setDialog("rename");}
              else if (id === "download" && target) void download();
              else if (id === "duplicate" && target) void run(async()=>{await api("/api/library/copy",{app,id:target.id});await list();});
              else if (id === "share" && target) void share();
              else if (id === "history" && target) setShowHistory(true);
              else if (id === "refresh") void list();
              else if (id === "list" || id === "grid") setGrid(id === "grid");
              else if (id.startsWith("new-"))
                startCreate(id.slice(4) as CreateChoice);
            }}
            items={
              menu.workspace ? [{id:"open-workspace",label:"Open workspace",icon:<AetherIcon name="folder"/>}] : menu.file
                ? [
                    { id: "open", label: "Open", icon: <AetherIcon name="open" width={15} height={15} /> },
                    { id: "details", label: "Details", icon: <AetherIcon name="document" width={15} height={15} /> },
                    {id:"rename",label:"Rename",icon:<AetherIcon name="pencil"/>,disabled:!menu.file.writable,separatorBefore:true},
                    {id:"download",label:"Download",icon:<AetherIcon name="import"/>,disabled:busy || menu.file.kind !== "file"},
                    {id:"duplicate",label:"Duplicate",icon:<AetherIcon name="copy"/>,disabled:busy || menu.file.kind !== "file"},
                    {id:"share",label:menu.file.scope === "workspace" ? "Make private" : "Share",icon:<AetherIcon name="link"/>,disabled:busy || !menu.file.writable || menu.file.kind !== "file"},
                    {id:"history",label:"History & collaboration",icon:<AetherIcon name="history"/>,disabled:menu.file.kind !== "file"},
                  ]
                : [
                    {
                      id: "add",
                      label: "Add New",
                      icon: <AetherIcon name="plus" width={15} height={15} />,
                      children: [["folder", "Folder", "folder"], ...cfg.menu.filter(([id])=>id !== "folder")].map(([id, label, icon]) => ({
                        id: "new-" + id,
                        label,
                        icon: <AetherIcon name={icon} width={15} height={15} />,
                      })),
                    },
                    { id: "details", label: "Details", icon: <AetherIcon name="document" width={15} height={15} />, disabled: !selected },
                    {id:"new-import",label:"Files upload",icon:<AetherIcon name="import"/>,separatorBefore:true},
                    {id:"view",label:"View",icon:<AetherIcon name="layout"/>,children:[{id:"list",label:"List",icon:<AetherIcon name="items"/>,checked:!grid},{id:"grid",label:"Gallery",icon:<AetherIcon name="layout"/>,checked:grid}]},
                    {id:"refresh",label:"Refresh",icon:<AetherIcon name="refresh"/>,separatorBefore:true},
                  ]
            }
          />
        )}
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        {showIntro && preferences.showUpdates && (
          <div style={{ marginBottom: 32 }}>
            {app === "cad" ? <CADWhatsNew /> : <ApplicationWelcome id={`${app}-welcome`} updates={APP_UPDATES[app]} name={cfg.brand} description={cfg.heroLead} artwork={<ApplicationArtwork app={app} />} wideArtwork={<ApplicationHeroArtwork app={app} />} />}
          </div>
        )}
        {showIntro && (
          <section className="library-start" aria-label="Get started">
            <h2>Get started</h2>
            <div className="library-start-cards">
              {cfg.start.map((card) => (
                <button
                  key={card.kind}
                  type="button"
                  disabled={busy || !card.action}
                  title={card.tooltip}
                  onClick={() => {
                    if (card.action === "new-doc") newDocument(card.kind);
                    else if (card.action === "dialog") startCreate(card.kind as CreateChoice);
                    else if (card.action === "import") input.current?.click();
                  }}
                >
                  <FileIcon icon={card.icon} size={34} />
                  <span><strong>{card.title}</strong><small>{card.tagline}</small></span>
                </button>
              ))}
            </div>
          </section>
        )}
        {notice && (
          <p className="library-notice" role="status">
            {notice}
            <IconButton label="Dismiss notification" onClick={() => setNotice("")}><AetherIcon name="close" /></IconButton>
          </p>
        )}
        <ApplicationListHeading>{view === "home" ? "Recently opened" : view === "workspace" ? workspace : titles[view]}</ApplicationListHeading>
        {(view === "personal" || view === "workspace" || folders.length > 0) && <Breadcrumbs items={[...(view === "workspace" && !activeWorkspace?.is_default ? [{id:"organization",label:directory?.organizations.find(o=>o.id===activeWorkspace?.organization)?.name ?? "Organization"}] : []),{id:"root",label:view === "workspace" ? workspace : "My files"},...folders.map(folder=>({id:folder.id,label:folder.name}))]} onNavigate={id=>{if(id === "organization"){const root=directory?.workspaces.find(w=>w.organization===activeWorkspace?.organization && w.is_default);if(root){setWorkspaceID(root.id);navigate("workspace");}}else visitFolder(id === "root" ? [] : folders.slice(0,folders.findIndex(f=>f.id===id)+1));}}/>}
        <ApplicationListControls filters={<div className="aui-file-type-filters" role="group" aria-label="Filter files by type">
          <button type="button" aria-pressed={typeFilter === "all"} onClick={()=>setTypeFilter("all")}>All</button>
          {cfg.types.map(type=><button key={type.id} type="button" aria-pressed={typeFilter===type.id} onClick={()=>setTypeFilter(type.id)}><FileIcon icon={type.icon} size={16}/>{type.label}</button>)}
        </div>} search={<input aria-label="Filter by name or person" placeholder="Filter by name or person" value={nameFilter} onChange={e=>setNameFilter(e.target.value)}/>} actions={
          <div className="library-list-tools">
            {(
              <button
                type="button"
                className="library-tool library-selected-chip"
                style={{visibility: selectedIds.size ? "visible" : "hidden"}}
                aria-label="Clear selection"
                onClick={() => {setSelected(null);setSelectedIds(new Set());}}
              >
                <AetherIcon name="close"/> {selectedIds.size} selected
              </button>
            )}
            <ToolMenu
              label="Sort"
              icon={<AetherIcon name="sort-chevron"/>}
              onPick={(id) => {
                if (id === "asc" || id === "desc") setSortAsc(id === "asc");
                else setSortKey(id as "name" | "opened" | "owner");
              }}
              items={[
                { id: "opened", icon:<AetherIcon name="history"/>, label: "Opened", checked: sortKey === "opened" },
                { id: "name", icon:<AetherIcon name="text"/>, label: "Name", checked: sortKey === "name" },
                { id: "owner", icon:<AetherIcon name="person"/>, label: "Owner", checked: sortKey === "owner" },
                { id: "asc", icon:<AetherIcon name="arrow-up"/>, label: "Ascending", checked: sortAsc },
                { id: "desc", icon:<AetherIcon name="arrow-down"/>, label: "Descending", checked: !sortAsc },
              ]}
            />
            <ToolMenu
              label=""
              ariaLabel="File view"
              icon={<AetherIcon name={grid ? "layout" : "items"} />}
              onPick={(id) => setGrid(id === "grid")}
              items={[
                { id: "list", label: "List view", icon: <AetherIcon name="items" width={15} height={15} />, checked: !grid },
                { id: "grid", label: "Grid view", icon: <AetherIcon name="layout" width={15} height={15} />, checked: grid },
              ]}
            />
            <button
              type="button"
              className="library-tool"
              aria-pressed={showDetails}
              onClick={() => {
                const next = !showDetails;
                setShowDetails(next);
                writeDetailsPreference(app, next);
              }}
            >
              <AetherIcon name="sidebar" /> Details
            </button>
          </div>
        }/>
        {directoryError && <p role="alert">Workspace directory: {directoryError}</p>}
        {view === "workspace" && (
          <p className="library-note">
            {workspace} · {cfg.brand} files and shared folders. Access follows this workspace’s permissions.
          </p>
        )}
        {view === "shared" && (
          <p className="library-note">
            Files individually shared with you will appear here once
            per-user sharing lands on the host. Workspace files live under
            your workspace in the sidebar.
          </p>
        )}
        {view === "trash" && (
          <p className="library-note">
            Deleted files will be recoverable here once host-side deletion
            lands.
          </p>
        )}
        <div className="library-listing">
          <div
            className="library-listing-main"
            aria-busy={loading}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
          >
            {loading ? (
              <div className="library-empty" role="status">Loading files…</div>
            ) : listingError ? (
              <div className="library-empty" role="alert">
                <h3>Unable to load files</h3>
                <p>{listingError}</p>
                <Button onClick={() => void list()}>Retry</Button>
              </div>
            ) : tableRows.length === 0 ? (
              <div className="library-empty">
                <AetherIcon name="folder" width={48} height={48} />
                <h3>
                  {query || nameFilter || typeFilter !== "all"
                    ? "No matching files"
                    : view === "home" || view === "recent"
                      ? "Your recent work will appear here"
                      : "This folder is ready for your work"}
                </h3>
                <p>
                  {query || nameFilter || typeFilter !== "all"
                    ? "Try another search."
                    : cfg.emptyHint}
                  {(nameFilter || typeFilter !== "all") && <Button onClick={() => {setNameFilter(""); setTypeFilter("all");}}>Clear filters</Button>}
                </p>
              </div>
            ) : grid ? (
              <div className="library-grid">
                {childWorkspaces.map(entry=><button key={entry.id} onClick={()=>{setWorkspaceID(entry.id);navigate("workspace");}}><FileIcon file={{name:entry.name,kind:"folder"}} size={28}/><strong>{entry.name}</strong><small>Workspace</small></button>)}
                {shown.map((file) => (
                  <button
                    key={file.id}
                    className={selected?.id === file.id ? "selected" : ""}
                    onClick={() => setSelected(file)}
                    onDoubleClick={() => open(file)}
                    onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); open(file); } }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelected(file);
                      setMenu({ x: e.clientX, y: e.clientY, file });
                    }}
                  >
                    <FileObjectPreview file={file} app={app} size="gallery" />
                    <strong>{file.name}</strong>
                    <small>{file.owner}</small>
                  </button>
                ))}
              </div>
            ) : (
              <ApplicationFileTable
                sort={{id:sortKey,ascending:sortAsc}} onSort={id=>{if (id === sortKey) setSortAsc(!sortAsc);else setSortKey(id as "name"|"opened"|"owner");}}
                columns={[
                  {id:"type", label:"Type", render:row => row.entry ? "Workspace" : row.file!.kind === "folder" ? "Folder" : fileTypeFor({...row.file!,app}).id === "project" || /\.acad$/i.test(row.name) ? "Hybrid Design" : fileTypeFor({...row.file!,app}).label},
                  {id:"opened", sortable:true, label:view === "home" || view === "recent" ? "Opened" : "Modified", render:file => file.date},
                  {id:"owner", sortable:true, label:"Owner", render:file => file.owner, secondary:true},
                ]}
                rows={tableRows}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                onSelect={row => setSelected(row.file ?? null)}
                onOpen={row=>{if(row.entry){setWorkspaceID(row.entry.id);navigate("workspace");}else if(row.file)open(row.file);}}
                onContextMenu={(row, event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelected(row.file ?? null);
                  setMenu({ x: event.clientX, y: event.clientY, file:row.file,workspace:row.entry });
                }}
              />
            )}
          </div>
          {showDetails && (
            <aside className="library-details studio-file-inspector">
              {selected ? (
                <FileDetails
                  name={selected.name}
                  icon={<FileObjectPreview file={selected} app={app} size="details" />}
                  subtitle={/\.acad$/i.test(selected.name) ? "Hybrid Design" : fileTypeFor({...selected, app}).label}
                  accessNote={selected.scope === "workspace"
                    ? "Access follows this workspace’s permissions"
                    : "Only you"}
                  information={[
                    { label: "Owner", value: selected.owner },
                    { label: "Modified", value: new Date(selected.modified * 1000).toLocaleString() },
                    ...(selected.kind === "file"
                      ? [{ label: "Size", value: `${Math.max(1, Math.round(selected.size / 1024))} KB` }]
                      : []),
                  ]}
                />
              ) : (
                <Inspector><div className="library-details-empty">
                  <AetherIcon name="document" width={70} height={70} />
                  <p>Select a file or folder to see its details.</p>
                </div></Inspector>
              )}
            </aside>
          )}
        </div>
      </main>
      {showHistory && selected && (
        <DocumentHistory
          file={{...selected,app}}
          onClose={() => setShowHistory(false)}
          onChanged={async () => { await list(); }}
        />
      )}
      {dialog && (
        <div className="library-modal">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={
              dialog === "folder" ? "New folder" : "Rename"
            }
            onSubmit={(e) => {
              e.preventDefault();
              void run(edit);
            }}
          >
            <h2>
              {dialog === "folder" ? "New folder" : "Rename"}
            </h2>
            <label>
              Name
              <TextField
                aria-label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
                maxLength={180}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <div>
              <Button onClick={() => setDialog(null)}>Cancel</Button>
              <Button primary type="submit" disabled={busy}>
                {dialog === "folder" ? "Create folder" : "Save name"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </ApplicationHomeFrame>
    </div>
  );
}
