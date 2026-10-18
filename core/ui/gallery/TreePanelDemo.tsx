import { useState } from "react";
import { AetherIcon, TreePanel, TreePanelSplit, type TreeNode, featureTreeActions, featureTreeMenuItems, type FeatureTreeItem } from "../src";

const initial: TreeNode[] = [
  { id: "assembly", label: "Assembly 1.step", category: "folder", icon: <AetherIcon name="collection-folder" />, children: [{ id: 'assembly-body', label: 'Assembly body', category: 'body', icon: <AetherIcon name="cube" /> }] },
  { id: "part", label: "JAEP100005R1 - Part 1.step", category: "folder", icon: <AetherIcon name="collection-folder" />, children: [{ id: 'part-body', label: 'Part body', category: 'body', icon: <AetherIcon name="cube" /> }] },
  ...['Body 03', 'Body 02', 'Sketch 02', 'Body 01', 'Sketch 01'].map(label => ({ id: label, label,
    category: label.startsWith('Body') ? 'body' : 'sketch', icon: <AetherIcon name={label.startsWith('Body') ? 'cube' : 'sketch'} />,
    dimmed: label !== 'Sketch 02' })),
  { id: 'folder-1', label: 'Folder 01', category: 'folder', icon: <AetherIcon name="collection-folder" />, children: [
    { id: 'folder-3', label: 'Folder 03', category: 'folder', icon: <AetherIcon name="collection-folder" /> },
    { id: 'folder-2', label: 'Folder 02', category: 'folder', icon: <AetherIcon name="collection-folder" /> },
  ] },
];
const visit = (nodes: readonly TreeNode[], update: (n: TreeNode) => TreeNode): TreeNode[] => nodes.map(n => update({ ...n, children: n.children && visit(n.children, update) }));
const remove = (nodes: readonly TreeNode[], id: string): TreeNode[] => nodes.filter(n => n.id !== id).map(n => ({ ...n, children: n.children && remove(n.children, id) }));

const initialParts: TreeNode[] = [
  { id: "result-1", label: "Part 1", category: "part", icon: <AetherIcon name="cube" /> },
  { id: "result-2", label: "Part 2", category: "part", icon: <AetherIcon name="cube" /> },
];
const flatten = (nodes: readonly TreeNode[]): TreeNode[] => nodes.flatMap(node => [node, ...flatten(node.children ?? [])]);

/** One reference model and renderer for the standalone specimen and sidebar composition. */
export function useReferenceTreePanel(initialSelected?: string, storageKey?: string) {
  const [nodes, setNodes] = useState(initial), [parts, setParts] = useState(initialParts);
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set(initialSelected ? [initialSelected] : []));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(["folder-1"]));
  const [renaming, setRenaming] = useState<string | null>(null);
  const [filter, setFilter] = useState(""), [filterGeneration, setFilterGeneration] = useState(0);
  const selected = [...selection][0];
  const selectedFeature = flatten(nodes).find(node => node.id === selected);
  const selectedNode = selectedFeature ?? parts.find(node => node.id === selected);
  const toggle = (id: string) => {
    const update = (node: TreeNode) => node.id === id ? { ...node, dimmed: !node.dimmed } : node;
    setNodes(rows => visit(rows, update)); setParts(rows => visit(rows, update));
  };
  const present = (rows: readonly TreeNode[]) => visit(rows, node => ({ ...node, actions:
    [{ id:"visibility",label:`${node.dimmed?"Show":"Hide"} ${node.label}`,icon:<AetherIcon name={node.dimmed?"hidden":"visible"}/>,pinned:!!node.dimmed,state:true }] }));
  const menuItems = (id:string) => {const node=[...flatten(nodes),...parts].find(node=>node.id===id);if(!node)return [];
    const item:FeatureTreeItem={id:node.id,label:node.label,type:node.category??"part",kind:node.category === "folder"?"folder":node.category === "sketch"?"feature":"part",hidden:node.dimmed};
    return featureTreeMenuItems(featureTreeActions(item,{selected:[item],features:[],available:["rename","visibility","delete"]}));
  };
  const command=(id:string,action:string)=>{if(action === "visibility")toggle(id);else if(action === "rename")setRenaming(id);else if(action === "delete"){setNodes(rows=>remove(rows,id));setParts(rows=>remove(rows,id));setSelection(new Set());}};
  const rename=(id:string,label:string)=>{setNodes(rows=>visit(rows,node=>node.id === id?{...node,label}:node));setParts(rows=>visit(rows,node=>node.id === id?{...node,label}:node));setRenaming(null);};
  const content = <TreePanelSplit primaryLabel="Items" secondaryLabel="Parts" storageKey={storageKey} primary={<TreePanel key={filterGeneration}
    title="Items" ariaLabel="Reference Items" nodes={present(nodes)} selectedIDs={selection} onSelect={ids => setSelection(new Set(ids))}
    filter={filter} onFilterChange={setFilter} filterLabel="Find a feature" emptyState="No features match your search."
    filterOptions={[
      { id: "body", label: "Bodies", icon: <AetherIcon name="cube" /> },
      { id: "sketch", label: "Sketches", icon: <AetherIcon name="sketch-nodes" /> },
      { id: "folder", label: "Folders", icon: <AetherIcon name="collection-folder" /> },
      { id: "plane", label: "Planes and Axes", icon: <AetherIcon name="planes-axes" /> },
      { id: "image", label: "Images", icon: <AetherIcon name="image" /> },
    ]} expandedIDs={expanded} onToggle={(id, value) => setExpanded(ids => { const next = new Set(ids); if (value) next.add(id); else next.delete(id); return next; })}
    renamingID={renaming} onCancelRename={() => setRenaming(null)} onRename={rename}
    controlsLabel="Feature commands" controls={[
      { id: "new-folder", label: "New folder", icon: <AetherIcon name="folder-add" />, onClick: () => {
        const id = crypto.randomUUID();
        const number = Math.max(0, ...flatten(nodes).map(node => Number(/^Folder (\d+)$/.exec(node.label)?.[1]) || 0)) + 1;
        setNodes(rows => [...rows, { id, label: `Folder ${String(number).padStart(2, "0")}`, category: "folder", icon: <AetherIcon name="collection-folder" /> }]);
        setSelection(new Set([id])); setFilter(""); setFilterGeneration(value => value + 1);
      } },
      { id: "rename", label: "Rename item", icon: <AetherIcon name="notes" />, disabled: !selectedFeature, shortcut: "F2", onClick: () => setRenaming(selected) },
      { id: "delete", label: "Delete item", icon: <AetherIcon name="delete" />, disabled: !selectedFeature, shortcut: "Delete", onClick: () => { setNodes(rows => remove(rows, selected)); setSelection(new Set()); } },
    ]} menuItems={menuItems} onCommand={command} onAction={toggle} />}
    secondary={<TreePanel title={`Parts (${parts.length})`} ariaLabel="Reference Parts" showFilter={false}
      nodes={present(parts)} renamingID={renaming} onRename={rename} onCancelRename={()=>setRenaming(null)} selectedIDs={selection} onSelect={ids => setSelection(new Set(ids))}
      menuItems={menuItems} onCommand={command} onAction={toggle} />} />;
  return { content, selectedNode };
}

/** The suite's standalone specimen uses the same content as the sidebar Layers tab. */
export function TreePanelDemo() {
  const { content } = useReferenceTreePanel(undefined, "aether-ui.showcase.tree-split");
  return <div data-testid="reference-collection" style={{ display: "flex", height: 778, width: 306 }}>{content}</div>;
}
