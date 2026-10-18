import { useRef, useState, type ReactNode } from "react";
import { AccountProfile, AuthenticationForm, Avatar, BatchActionReview, Button, ChoiceCard, Dialog, FieldMappingForm, OverlayScope, PasswordField, PersonalizationForm, SegmentedControl, SequenceBrowser, SettingsLink, StructureStep, SubscriptionPicker, TeamMembersPanel, TemplateEditor, TextField, TextVariants, type SequenceItem, type TeamMember } from "../src";
import "./WorkflowWidgetsDemo.css";

function Feedback({ children }: { children: ReactNode }) { return <p className="workflow-demo-feedback" role="status">{children}</p>; }
function AccessDemo() {
  const [mode, setMode] = useState<"login" | "signup">("login"), [notice, setNotice] = useState("");
  return <><AuthenticationForm mode={mode} appName="Aether" onModeChange={setMode} onSubmit={value => setNotice(`${mode === "login" ? "Login" : "Sign-up"} form validated for ${value.email}.`)} onProvider={provider => setNotice(`${provider} sign-in requested in this local demo.`)} onResetPassword={() => setNotice("Password recovery selected. This demo sends no email.")} /><Feedback>{notice}</Feedback></>;
}
function PersonalizeDemo() {
  const [notice, setNotice] = useState("");
  return <><PersonalizationForm onImport={source => setNotice(source.kind === "website" ? `Website source selected: ${source.url}` : source.kind === "document" ? `Selected ${source.files[0]?.name}` : `Saved ${source.notes.length} characters of company information.`)} /><Feedback>{notice}</Feedback></>;
}
const initialSteps = [
  { id: "greeting", title: "Greeting", description: "Hi recipient’s name" },
  { id: "obstacle", title: "Obstacle", description: "Current situation of the recipient with the obstacle they might face" },
  { id: "solution", title: "Introduce solution", description: "Your company’s solution and social proof" },
  { id: "benefits", title: "Benefits", description: "Benefits of your solution and a personal touch" },
  { id: "cta", title: "Call to action", description: "A clear next step tailored to the recipient" },
];
function FrameworkDemo({ initialStage }: { initialStage: "import" | "structure" }) {
  const [stage, setStage] = useState(initialStage), [name, setName] = useState("Introduction"), [example, setExample] = useState(""), [steps, setSteps] = useState(initialSteps), [notice, setNotice] = useState("");
  return <><TemplateEditor stage={stage} name={name} example={example} steps={steps} onNameChange={setName} onExampleChange={setExample} onImport={() => { setSteps(example.split(/\n+/).filter(line => line.trim()).map((line, i) => ({ id: String(i), title: `Section ${i + 1}`, description: line.trim() }))); setStage("structure"); setNotice("Each paragraph becomes a section in this local example."); }} onSave={() => setNotice(`Saved ${name} with ${steps.length} sections.`)} onCancel={() => { setStage("import"); setExample(""); setNotice("Draft cleared."); }} /><Feedback>{notice}</Feedback></>;
}
function TeamDemo() {
  const [members, setMembers] = useState<TeamMember[]>([
    { id: "1", name: "James Thomas", email: "james@example.com", credits: 1000 },
    { id: "2", name: "John Anderson", email: "john@example.com", credits: 700 },
    { id: "3", name: "Sophia Taylor", email: "sophia@example.com", credits: 200 },
    { id: "4", name: "Gregory Murray", email: "gregory@example.com", credits: 1000 },
  ]), [notice, setNotice] = useState("");
  return <><TeamMembersPanel members={members} totalCredits={5000} onInvite={email => { if (members.some(member => member.email.toLowerCase() === email.toLowerCase())) { setNotice("That member is already listed."); return; } setMembers(old => [...old, { id: crypto.randomUUID(), name: email.split("@")[0], email, credits: 0 }]); setNotice("Member added to the demo. No invitation was sent."); }} onCreditChange={(id, credits) => { setMembers(old => old.map(member => member.id === id ? { ...member, credits } : member)); setNotice("Credit limit updated."); }} onRemove={id => { setMembers(old => old.filter(member => member.id !== id)); setNotice("Member removed from the demo."); }} /><Feedback>{notice}</Feedback></>;
}
function BatchDemo() {
  const [notice, setNotice] = useState("");
  return <><BatchActionReview title="Generate for all prospects" description="Sequences for 1,024 leads use 5,120 message credits and 3,072 enrichment credits." totalLabel="Total credits needed: 8,192" fields={[{ label: "Persona", value: "Startup founder" }, { label: "Event", value: "Conference" }, { label: "Inbound", value: "Form submission" }, { label: "Name", value: "first_name" }, { label: "Trigger or signal", value: "event_description" }, { label: "LinkedIn or email", value: "email_address" }]} onRun={() => setNotice("Sample batch generated for 1,024 prospects. No messages were sent.")} onCancel={() => setNotice("Batch cancelled.")} /><Feedback>{notice}</Feedback></>;
}
function AccountDemo() {
  const initial = { name: "Gregory Murray", company: "Aether Technologies" };
  const [saved, setSaved] = useState(initial), [value, setValue] = useState(initial), [notice, setNotice] = useState(""), [action, setAction] = useState<string | null>(null), [detail, setDetail] = useState(""), [email, setEmail] = useState("gregory@example.com");
  return <><AccountProfile value={value} email={email} onChange={setValue} onAction={id => { setAction(id); setDetail(""); }} onSave={() => { setSaved(value); setNotice("Profile changes saved in the demo."); }} onCancel={() => { setValue(saved); setNotice("Unsaved changes discarded."); }} />
    <Dialog open={Boolean(action)} title={action === "delete" ? "Remove the sample profile?" : action === "api-key" ? "Demo API connection" : `Update ${action ?? "profile"}`} onClose={() => setAction(null)}>
      {action === "api-key" ? <p>demo-key · local example only</p> : action !== "delete" && <label>New {action}{action === "password" ? <PasswordField aria-label="New password" value={detail} onChange={e => setDetail(e.target.value)} /> : <TextField type="email" aria-label="New email" value={detail} onChange={e => setDetail(e.target.value)} />}</label>}
      <div className="aui-workflow-actions"><Button onClick={() => setAction(null)}>Cancel</Button><Button primary disabled={action === "password" ? detail.length < 8 : action === "email" ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detail) : false} onClick={() => { setNotice(action === "delete" ? "Sample profile cleared. No account was deleted." : `${action} action completed in the demo.`); if (action === "email") setEmail(detail); if (action === "delete") { setSaved({ name: "", company: "" }); setValue({ name: "", company: "" }); } setAction(null); }}>Confirm</Button></div>
    </Dialog><Feedback>{notice}</Feedback></>;
}
function PlansDemo() {
  const [plan, setPlan] = useState("basic"), [period, setPeriod] = useState("yearly"), [allowance, setAllowance] = useState("6k"), [notice, setNotice] = useState("");
  return <><SubscriptionPicker selected={plan} onSelect={setPlan} period={period} onPeriodChange={setPeriod} allowance={allowance} onAllowanceChange={setAllowance} allowances={[{ value: "6k", label: "6K credits / year" }, { value: "12k", label: "12K credits / year" }]} plans={[
    { id: "basic", label: "Basic", description: "Best for manual prospecting", price: period === "yearly" ? "$20 / month" : "$24 / month", detail: period === "yearly" ? "$240 / year" : "Billed monthly" },
    { id: "pro", label: "Pro", description: "Personalized copy per prospect", price: period === "yearly" ? "$157 / month" : "$189 / month", detail: "120K credits" },
    { id: "scale", label: "Scale", description: "All in Pro, lower credit costs", price: period === "yearly" ? "$614 / month" : "$737 / month", detail: "1.2M credits" },
  ]} onSubscribe={() => setNotice(`${plan} selected · ${period} · ${allowance} allowance. No purchase was made.`)} /><Feedback>{notice}</Feedback></>;
}
function MappingDemo() {
  const [mode, setMode] = useState("list"), [fileName, setFileName] = useState("uploaded-file.csv"), [columns, setColumns] = useState(["first_name", "company", "event_description", "profile_url", "email_address"]), [value, setValue] = useState<Record<string, string>>({ name: "first_name", profile: "profile_url" }), [notice, setNotice] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  return <><FieldMappingForm mode={mode} onModeChange={setMode} fileName={fileName} itemCount={mode === "list" ? "Lead list" : "Individual record"} onUpdateFile={() => picker.current?.click()} columns={columns} value={value} onChange={setValue} fields={[{ id: "name", label: "Name", required: true }, { id: "info", label: "Prospect info" }, { id: "trigger", label: "Trigger" }, { id: "instructions", label: "Instructions" }, { id: "profile", label: "LinkedIn profile" }]} onContinue={() => setNotice(`Mapping ready: ${Object.values(value).filter(Boolean).length} columns connected.`)} />
    <input ref={picker} type="file" accept=".csv" hidden aria-label="Update mapping CSV" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const header = (await file.text()).split(/\r?\n/)[0]; const fields = header.match(/(?:"(?:[^"]|"")*"|[^,]+)(?=,|$)/g)?.map(field => field.trim().replace(/^"|"$/g, "").replace(/""/g, '"')).filter(Boolean) ?? []; if (!fields.length) { setNotice("The file needs a header row."); return; } setColumns([...new Set(fields)]); setValue({}); setFileName(file.name); setNotice("Choose columns from the updated file."); }} />
    <Feedback>{notice}</Feedback></>;
}
function VariantsDemo() {
  const [tone, setTone] = useState("direct"), [length, setLength] = useState(2), [selected, setSelected] = useState("1"), [page, setPage] = useState(0);
  const starters = tone === "friendly" ? ["Let’s improve your outreach", "Make every conversation count", "A little help for your next message"] : tone === "formal" ? ["Improve outbound communication", "Increase the quality of email conversations", "Optimize your outreach process"] : ["Boost your email outreach", "Improve your email conversations", "Turn prospects into conversations"];
  return <TextVariants tone={tone} onToneChange={setTone} length={length} onLengthChange={setLength} selected={selected} onSelect={setSelected} onMore={() => setPage(value => value + 1)} variants={starters.map((text, i) => ({ id: String(i + 1), text: `${page % 2 ? "Aether: " : ""}${text}${length > 1 ? " with Aether" : ""}${length > 2 ? ". Personalized messages, tailored to your audience." : "."}` }))} />;
}
function SequencesDemo() {
  const [items, setItems] = useState<SequenceItem[]>(["Healthcare pioneers", "Retail revolutionaries", "Growth companies", "E-commerce giants", "Green energy advocates", "Manufacturing trailblazers"].map((label, i) => ({ id: String(i), label, group: "Drafts" })).concat([{ id: "general", label: "General", group: "Team space" }, { id: "travel", label: "Travel enthusiasts", group: "Team space" }]));
  const [selected, setSelected] = useState("2"), [selectedMessage, setSelectedMessage] = useState("intro"), [notice, setNotice] = useState("");
  const defaults = [{ id: "intro", title: "Introduction", description: "Check relevancy" }, { id: "follow", title: "Follow-up", description: "Refocus" }, { id: "webinar", title: "Webinar", description: "Share an invitation" }, { id: "newsletter", title: "Newsletter signup", description: "Keep in touch" }];
  const [messages, setMessages] = useState<Record<string, typeof defaults>>({});
  const current = messages[selected] ?? defaults;
  return <><SequenceBrowser items={items} selected={selected} onSelect={id => { setSelected(id); setSelectedMessage((messages[id] ?? defaults)[0]?.id ?? ""); }} onAdd={() => { const id = crypto.randomUUID(); setItems(old => [...old, { id, label: "Untitled sequence", group: "Drafts" }]); setMessages(old => ({ ...old, [id]: [] })); setSelected(id); }} onRename={(id, label) => setItems(old => old.map(item => item.id === id ? { ...item, label } : item))} onCommand={(id, command) => { const original = items.find(item => item.id === id); if (!original) return; if (command === "delete") { const next = items.filter(item => item.id !== id); setItems(next); if (selected === id) setSelected(next[0]?.id ?? ""); } else if (command === "duplicate") { const copyID = crypto.randomUUID(); setItems(old => [...old, { ...original, id: copyID, label: `${original.label} copy` }]); setMessages(old => ({ ...old, [copyID]: old[id] ?? defaults })); setSelected(copyID); } else setItems(old => old.map(item => item.id === id ? { ...item, group: "Team space" } : item)); }} messages={selected ? current : []} selectedMessage={selectedMessage} onMessageSelect={setSelectedMessage} onAddMessage={() => { if (!selected) { setNotice("Add a sequence first."); return; } const id = crypto.randomUUID(); setMessages(old => ({ ...old, [selected]: [...current, { id, title: "Follow-up", description: "New message" }] })); setSelectedMessage(id); }} onGenerate={() => setNotice(`${current.length} sample messages generated. No messages were sent.`)} /><Feedback>{notice}</Feedback></>;
}
const DEMOS = [
  ["Sequences + messages", SequencesDemo], ["Sign in + create account", AccessDemo], ["Team members + credit limits", TeamDemo],
  ["Personalization source", PersonalizeDemo], ["Batch action review", BatchDemo], ["Import framework", () => <FrameworkDemo initialStage="import" />],
  ["Confirm structure", () => <FrameworkDemo initialStage="structure" />], ["Account settings", AccountDemo], ["Subscription plans", PlansDemo],
  ["File + field mapping", MappingDemo], ["Message variants", VariantsDemo],
] as const;
export function WorkflowWidgetsDemo() {
  const [mode, setMode] = useState("light");
  return <div className="workflow-demo"><header><p>Standard reusable widgets from the supplied reference. Local sample data; no account, billing or messaging changes.</p><SegmentedControl ariaLabel="Workflow preview theme" value={mode} onChange={setMode} options={[{ id: "light", label: "Slate light" }, { id: "dark", label: "Slate dark" }]} /></header>
    <div className="workflow-demo-grid">{DEMOS.map(([label, Demo]) => <div className="workflow-demo-specimen" key={label}><h3>{label}</h3><OverlayScope className={`aether-theme-aether-slate aether-${mode}-theme`}><Demo /></OverlayScope></div>)}</div>
  </div>;
}
export function WorkflowElementDemo({ kind }: { kind: "avatar" | "password" | "choice" | "setting" | "step" }) {
  const [value, setValue] = useState("basic"), [notice, setNotice] = useState("");
  return <div className="workflow-element-demo">{kind === "avatar" ? <div className="aui-workflow-actions"><Avatar name="James Thomas" /><Avatar name="Sophia Taylor" size="small" /><Avatar name="New member" /></div> : kind === "password" ? <label className="aui-workflow-field">Password<PasswordField aria-label="Password" placeholder="Enter a password" autoComplete="off" /></label> : kind === "choice" ? <div className="aui-workflow-stack">{["Basic", "Pro"].map(label => <ChoiceCard key={label} name="element-plan" value={label.toLowerCase()} label={label} description="Selectable card with supporting detail" checked={value === label.toLowerCase()} onChange={setValue} />)}</div> : kind === "setting" ? <><SettingsLink label="Email" description="name@example.com" onClick={() => setNotice("Email settings selected.")} /><SettingsLink label="Delete account" description="Destructive action variant" destructive onClick={() => setNotice("Destructive action selected in the demo.")} /><SettingsLink label="Managed setting" description="Disabled by your organization" disabled /></> : <StructureStep title="Greeting" description="Introduce the recipient and establish the context." position={1} />}
    {notice && <Feedback>{notice}</Feedback>}
  </div>;
}

export function WorkflowLinkDemo() {
  const [selected, setSelected] = useState(false);
  return <Button appearance="link" onClick={() => setSelected(value => !value)}>{selected ? "Action selected" : "Text action"}</Button>;
}
