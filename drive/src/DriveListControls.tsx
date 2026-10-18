import { ApplicationListControls, FileTypeFilters, Tabs } from "@aether/ui";
import type { ReactNode } from "react";

/** One filter/control row for every Drive file list, using shared Aether UI widgets. */
export function DriveListControls({ direction, onDirection, type, onType, filter, onFilter, children }: {
  direction?: "with" | "by"; onDirection: (value: "with" | "by") => void;
  type: string; onType: (value: string) => void;
  filter: string; onFilter: (value: string) => void; children?: ReactNode;
}) {
  return <ApplicationListControls filters={<>
    {direction && <Tabs tabs={[{id:"with",label:"With you"},{id:"by",label:"By you"}]} activeID={direction} onSelect={id=>onDirection(id as "with"|"by")}/>}
    <FileTypeFilters value={type} onChange={onType} quickIDs={["folder","part","assembly","show","pdf"]}/>
  </>} search={<input aria-label="Filter by name or person" placeholder="Filter by name or person" value={filter} onChange={event=>onFilter(event.target.value)}/>}
  actions={children}/>;
}
