import { Children, isValidElement, type ReactNode } from "react";
import { SHOWCASE_TABS, comparisonGroup, type ShowcaseTabID } from "../showcase";
import "./ShowcaseLayout.css";

/** Mount one review family or one focused section, without duplicating specimens. */
export function ShowcaseSections({ tab, selected, individual = false, children }: { tab: ShowcaseTabID; selected?: string; individual?: boolean; children: ReactNode }) {
  const current = SHOWCASE_TABS.find(item => item.id === tab)!;
  const title = selected && current.sections.includes(selected) ? selected : current.sections[0];
  const comparison = comparisonGroup(tab, title, individual);
  const titles = comparison?.sections ?? [title];
  const sections = new Map(Children.toArray(children).flatMap(child =>
    isValidElement<{ title: string }>(child) ? [[child.props.title, child] as const] : []));
  for (const name of titles) if (!sections.has(name)) throw new Error(`Showcase section missing: ${name}`);
  return <div className="showcase-sections" data-comparison={comparison?.id}>{titles.map(name => sections.get(name))}</div>;
}
