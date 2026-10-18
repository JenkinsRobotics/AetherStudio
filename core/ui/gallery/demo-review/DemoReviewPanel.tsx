import { useRef, useState } from "react";
import { AetherIcon, DocumentCollaborationPanel, IconButton, SegmentedControl } from "../../src";
import { localReview } from "./local-review";
import "./demo-review.css";
import { ModelReviewConversation } from "./ModelReviewConversation";

/** Approved widgets composed inside the app's existing sidebar container. */
export function DemoReviewPanel({ documentName, selectedName, onClose, variant = "standard" }: {
  documentName: string; selectedName?: string; onClose: () => void; variant?: "standard" | "conversation";
}) {
  return variant === "conversation" ? <ModelReviewConversation documentName={documentName} selectedName={selectedName}/>
    : <StandardDemoReviewPanel documentName={documentName} selectedName={selectedName} onClose={onClose}/>;
}
function StandardDemoReviewPanel({ documentName, selectedName, onClose }: {
  documentName: string; selectedName?: string; onClose: () => void;
}) {
  const [tab, setTab] = useState("comments");
  const context = useRef({ name: documentName, selected: selectedName });
  context.current = { name: documentName, selected: selectedName };
  const [connection] = useState(() => localReview(() => context.current));
  return <section className="ps-document-review" aria-label="Comments and tasks">
    <header className="ps-review-context"><span title={documentName}>{documentName}</span><IconButton label="Close comments and tasks" size="small" onClick={onClose}><AetherIcon name="close"/></IconButton></header>
    <SegmentedControl ariaLabel="Review section" className="ps-review-tabs" value={tab} onChange={setTab}
      options={[{ id: "comments", label: "Comments" }, { id: "tasks", label: "Tasks" }]}/>
    <div className="ps-review-page" hidden={tab !== "comments"}>
      <DocumentCollaborationPanel connection={connection} kind="comments"/>
    </div>
    <div className="ps-review-page" hidden={tab !== "tasks"}>
      <DocumentCollaborationPanel connection={connection} kind="tasks"/>
    </div>
    <small className="ps-review-local">Local review · Kept in this window only</small>
  </section>;
}
