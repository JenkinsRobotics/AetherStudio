import { ModelReviewConversation } from "../demo-review/ModelReviewConversation";
import { AetherIcon, IconButton, DocumentVersionPanel } from "../../src";
import { documentHistoryPreview } from "../document-history-preview";
import type { ModelPart } from "./state";

export function ModelCommentsPanel({ selected, documentName = "Scifirobot" }: { selected?: ModelPart; documentName?: string }) {
  return <ModelReviewConversation documentName={documentName} selectedName={selected?.name}/>;
}

export function ModelRevisionsPanel({ onClose }: { onClose: () => void }) {
  return <section className="ps-revisions-panel" aria-label="Model revisions">
    <div className="ps-revision-context">
      <small className="ps-review-caption">Read-only example history</small>
      <IconButton label="Close revisions" size="small" onClick={onClose}><AetherIcon name="close"/></IconButton>
    </div>
    <DocumentVersionPanel connection={documentHistoryPreview}/>
  </section>;
}

export { VersionControlDemo as ModelVersionControlPanel } from "../demo-review/VersionControlDemo";
