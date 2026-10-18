import { useRef, useState } from "react";
import { AetherIcon, IconButton, MenuButton, type AssistantMessage } from "../../src";
import { AssistantPanel } from "../../src/AssistantPanel";
import { type ModelPart } from "./state";

/** Local UI preview only; no provider calls or pretend modeling actions. */
const CHAT_TOOLS = [
  { id: "image", label: "Create an image", icon: "image" },
  { id: "web", label: "Search the web", icon: "search" },
  { id: "code", label: "Write code", icon: "code" },
  { id: "research", label: "Run deep research", icon: "document-search" },
  { id: "think", label: "Think longer", icon: "brain" },
] as const;
export function ModelChatPanel({ parts, selected }: { parts: ModelPart[]; selected?: ModelPart }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [conversation, setConversation] = useState(0);
  const [intent, setIntent] = useState("");
  const [mode, setMode] = useState("Normal");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const activeTool = CHAT_TOOLS.find(tool => tool.id === intent);
  function submit(text: string) {
    const question = activeTool ? "" : text.toLowerCase();
    const reply = question === "summarize this scene"
      ? `Local scene summary: Scifirobot contains ${parts.length} parts; ${parts.filter(part => part.visible).length} are visible.\n\n${parts.map(part => part.name).join(" · ")}`
      : question === "inspect the selected part"
      ? selected ? `Local selection: ${selected.name}.\nPosition: ${selected.transform.position.join(", ")} cm\nRotation: ${selected.transform.rotation.join(", ")}°\nScale: ${selected.transform.scale.join(", ")}\nVisibility: ${selected.visible ? "Shown" : "Hidden"}` : "Nothing is selected. Choose a part in the viewport or parts footer, then ask again."
      : question === "how do i edit this model?"
      ? "Select a part, then use Move, Rotate or Scale, or edit its properties on the right. Add primitives from the lower toolbar or the parts footer. Undo with Command/Ctrl-Z; redo with Command/Ctrl-Shift-Z. These controls edit the local demo scene."
      : "Your prompt is saved in this local preview. No AI provider is connected, so I cannot generate an AI reply or model changes. Try a sample question to inspect the current scene.";
    const details = [activeTool && `Tool: ${activeTool.label}`, mode !== "Normal" && `Response style: ${mode}`, attachments.length > 0 && `Attachments (local): ${attachments.map(file => file.name).join(", ")}`].filter(Boolean).join("\n");
    setMessages(current => [...current, { id: crypto.randomUUID(), role: "user", text: details ? `${text}\n\n${details}` : text }, { id: crypto.randomUUID(), role: "assistant", text: reply }]);
    setAttachments([]);
  }
  return <AssistantPanel key={conversation} title="Model assistant" heading="AI chat" layout="agent"
    status="Local preview · No AI provider connected" messages={messages} onSubmit={submit}
    headerActions={<IconButton label="New chat" size="small" onClick={() => { setMessages([]); setAttachments([]); setIntent(""); setMode("Normal"); setConversation(value => value + 1); }}><AetherIcon name="plus"/></IconButton>}
    context={<div className="ps-composer-context"><span className="ps-chat-context"><AetherIcon name="cube"/>{selected?.name ?? "Whole scene"}</span>
      {activeTool && <span className="ps-composer-chip">{activeTool.label}<IconButton label="Clear selected tool" size="small" onClick={() => setIntent("")}><AetherIcon name="close"/></IconButton></span>}
      {attachments.map((file, index) => <span className="ps-composer-chip" key={`${file.name}-${index}`} title={file.name}><AetherIcon name="document"/><span>{file.name}</span><IconButton label={`Remove ${file.name}`} size="small" onClick={() => setAttachments(files => files.filter((_, i) => i !== index))}><AetherIcon name="close"/></IconButton></span>)}
    </div>}
    composerActions={<>
      <input ref={fileInput} type="file" multiple hidden aria-label="Attach files to chat" onChange={event => { setAttachments(files => [...files, ...Array.from(event.target.files ?? [])].slice(0, 5)); event.target.value = ""; }}/>
      <IconButton className="ps-composer-add" label="Attach files" size="small" onClick={() => fileInput.current?.click()}><AetherIcon name="plus"/></IconButton>
      <MenuButton className="ps-composer-pill" label="Tools" placement="top-start" items={CHAT_TOOLS.map(tool => ({ ...tool, icon: <AetherIcon name={tool.icon}/>, kind: "radio", checked: intent === tool.id }))} onSelect={setIntent}><AetherIcon name="sliders"/><span>Tools</span></MenuButton>
      <MenuButton className="ps-composer-pill" label="Response style" placement="top-start" items={["Normal", "Concise", "Detailed"].map(label => ({ id: label, label, kind: "radio", checked: mode === label }))} onSelect={setMode}><AetherIcon name="pencil"/><span>{mode}</span></MenuButton>
      <button className="ps-composer-pill ps-composer-voice" type="button" disabled title="Voice input needs a connected provider"><AetherIcon name="waveform"/><span>Voice</span></button>
    </>}
    welcome={<div className="ps-chat-welcome"><AetherIcon name="comment"/><h3>Explore your model</h3><p>Keep your ideas beside the workspace.</p><small>This local preview can show scene information. AI replies require a connected provider.</small></div>}
    suggestions={["Summarize this scene", "Inspect the selected part", "How do I edit this model?"]}/>;
}
