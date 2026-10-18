import "./WorkflowElements.css";
export interface StructureStepProps { title: string; description: string; position: number; }
export function StructureStep({ title, description, position }: StructureStepProps) {
  return <div className="aui-structure-step"><span className="aui-structure-step-marker" aria-label={`Step ${position}`}>{position}</span><span><strong>{title}</strong><small>{description}</small></span></div>;
}
