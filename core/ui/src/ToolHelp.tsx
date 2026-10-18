import type { ReactElement, ReactNode } from "react";
import { Tooltip } from "./Tooltip";
export interface ToolHelpContent { summary: string; steps: readonly string[]; illustration?: ReactNode; }
/** Shared, delayed instructional help for ribbon tools and menu entries. */
export function ToolHelp({label,help,disabledReason,children}:{label:string;help?:ToolHelpContent;disabledReason?:string;children:ReactElement<{"aria-describedby"?:string}>}) {
 if(!help)return children;
 return <Tooltip placement="right-start" delayMilliseconds={650} disabledReason={disabledReason} content={<span className="aui-tool-help"><strong>{label}</strong><span>{help.summary}</span><ol>{help.steps.map(step=><li key={step}>{step}</li>)}</ol>{help.illustration}</span>}>{children}</Tooltip>;
}
