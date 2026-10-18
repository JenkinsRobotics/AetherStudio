import { AetherIcon, type MenuItem } from "@aether/ui";

/** Background actions reuse the same creation commands as the sidebar. */
export function driveBackgroundMenu({ creation, canCreate, grid, details, selected, count, busy, sort = "name", ascending = true }: {
  creation: MenuItem[]; canCreate: boolean; grid: boolean; details: boolean;
  selected: number; count: number; busy: boolean; sort?: string; ascending?: boolean;
}): MenuItem[] {
  return [
    { id: "new", label: "New", icon: <AetherIcon name="new" />, disabled: !canCreate,
      children: creation.filter(item => !item.id.startsWith("upload")) },
    ...creation.filter(item => item.id.startsWith("upload")).map(item => ({...item, disabled: !canCreate})),
    { id: "view", label: "View", icon: <AetherIcon name="grid-2" />, separatorBefore: true, children: [
      { id: "view-list", label: "List", icon: <AetherIcon name="list" />, kind: "radio", checked: !grid },
      { id: "view-grid", label: "Gallery", icon: <AetherIcon name="grid-2" />, kind: "radio", checked: grid },
      { id: "details", label: "Details panel", icon: <AetherIcon name="sidebar-right" />, separatorBefore:true, kind: "checkbox", checked: details },
    ] },
    { id: "sort", label: "Sort by", icon: <AetherIcon name="sort-chevron" />, children: [
      {id: "sort:name", label: "Name", icon:<AetherIcon name="text"/>, kind:"radio", checked:sort === 'name'},
      {id: "sort:modified", label: "Modified", icon:<AetherIcon name="history"/>, kind:"radio", checked:sort === 'modified'},
      {id: "sort:size", label: "Size", icon:<AetherIcon name="box"/>, kind:"radio", checked:sort === 'size'},
      {id: "order:ascending", label: "Ascending", icon:<AetherIcon name="arrow-up"/>, kind:"radio", checked:ascending, separatorBefore:true},
      {id: "order:descending", label: "Descending", icon:<AetherIcon name="arrow-down"/>, kind:"radio", checked:!ascending},
    ] },
    { id: "select-all", label: "Select all", icon:<AetherIcon name="check"/>, separatorBefore: true, disabled: count === 0 },
    { id: "clear-selection", label: "Clear selection", icon:<AetherIcon name="close"/>, disabled: selected === 0 },
    { id: "refresh", label: "Refresh", icon: <AetherIcon name="refresh" />, separatorBefore: true, disabled: busy },
  ];
}
