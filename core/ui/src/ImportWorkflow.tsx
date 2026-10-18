import { AetherIcon } from "./AetherIcon";
import { Button } from "./Button";
import "./ConceptWidgets.css";

export interface ImportFileItem { id: string; name: string; detail: string; }
export interface ImportWorkflowProps { title: string; detail: string; destination: string; files: readonly ImportFileItem[]; step?: number; stepCount?: number; options?: readonly string[]; onBack?: () => void; onImport?: () => void; }
export function ImportWorkflow({ title, detail, destination, files, step = 2, stepCount = 3, options = [], onBack, onImport }: ImportWorkflowProps) {
  return <section className="aui-import-workflow" aria-label={title}><div className="aui-import-workflow__steps">{Array.from({ length: stepCount }, (_, index) => <span key={index} data-complete={index < step} />)}</div><header className="aui-import-workflow__header"><AetherIcon name="import" /><strong>{title}</strong><span>{detail}</span></header><div className="aui-import-workflow__destination"><AetherIcon name="folder" /><div><span>DESTINATION</span><strong>{destination}</strong></div></div><div>{files.map((file) => <div className="aui-import-workflow__file" key={file.id}><AetherIcon name="file-character" /><div><strong>{file.name}</strong><span>{file.detail}</span></div></div>)}</div><div className="aui-import-workflow__options">{options.map((option, index) => <label key={option}><input type="checkbox" defaultChecked={index === 0} />{option}</label>)}</div><div className="aui-import-workflow__actions"><Button onClick={onBack}>Back</Button><Button primary onClick={onImport}>Add {files.length} file{files.length === 1 ? "" : "s"}</Button></div></section>;
}
