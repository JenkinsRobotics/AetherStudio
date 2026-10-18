import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  AnnouncementCard,
  AssistantPanel,
  ImportWorkflow,
  MaterialBrowser,
  MaterialEditor,
  SpecimenBoard,
} from "./ConceptWidgets";

test("SpecimenBoard renders reusable widget families and their specimens", () => {
  render(<SpecimenBoard eyebrow="UI SPECIMEN BOARD" title="Template Matrix" detail="Shared concepts" stats={["36 TEMPLATES"]} status="Shared components update live" sections={[{
    id: "panels",
    title: "Panels",
    detail: "Reusable surfaces",
    maximumWidth: 410,
    specimens: [{ id: "assistant", title: "Assistant", detail: "Docked helper", icon: "aether", previewHeight: 240, content: <button>Try assistant</button> }],
  }]} />);
  expect(screen.getByText("Template Matrix")).toBeTruthy();
  expect(screen.getByText("UI SPECIMEN BOARD")).toBeTruthy();
  expect(screen.getByText("36 TEMPLATES")).toBeTruthy();
  expect(screen.getByText("Shared components update live")).toBeTruthy();
  expect(screen.getByText("Panels")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try assistant" })).toBeTruthy();
});

test("AssistantPanel turns a suggestion into a submitted message", () => {
  const onSubmit = vi.fn();
  render(<AssistantPanel title="Aether Agent" messages={[{ id: "hello", role: "assistant", text: "How can I help?" }]} suggestions={["Review this rig"]} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole("button", { name: "Review this rig" }));
  expect((screen.getByRole("textbox", { name: "Ask Aether Agent" }) as HTMLInputElement).value).toBe("Review this rig");
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(onSubmit).toHaveBeenCalledWith("Review this rig");
});

test("material widgets expose editing, filtering, and selection callbacks", () => {
  const onNameChange = vi.fn();
  const onChannelChange = vi.fn();
  const onSelect = vi.fn();
  const { rerender } = render(<MaterialEditor name="Gold" color="#c7b477" type="Glossy" channels={[{ id: "roughness", label: "Roughness", value: .23 }]} onNameChange={onNameChange} onChannelChange={onChannelChange} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Material name" }), { target: { value: "Brushed Gold" } });
  fireEvent.change(screen.getByRole("slider", { name: "Roughness" }), { target: { value: ".5" } });
  expect(onNameChange).toHaveBeenCalledWith("Brushed Gold");
  expect(onChannelChange).toHaveBeenCalledWith("roughness", .5);

  rerender(<MaterialBrowser materials={[{ id: "red", name: "Red ABS", category: "Plastic", color: "#c62935" }, { id: "glass", name: "Clear Glass", category: "Glass", color: "#e8edf1" }]} onSelect={onSelect} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Search materials" }), { target: { value: "glass" } });
  expect(screen.queryByRole("button", { name: /Red ABS/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Clear Glass/ }));
  expect(onSelect).toHaveBeenCalledWith("glass");
  fireEvent.click(screen.getByRole("radio", { name: "Environment" }));
  expect(screen.getByText("No environments supplied.")).toBeTruthy();
  rerender(<MaterialBrowser showTabs={false} materials={[{ id: "glass", name: "Clear Glass", category: "Glass", color: "#e8edf1" }]} onSelect={onSelect} />);
  expect(screen.queryByRole("radio", { name: "Environment" })).toBeNull();
  expect(screen.getByRole("textbox", { name: "Search materials" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Clear Glass/ }));
  expect(onSelect).toHaveBeenCalledTimes(2);
});

test("import and announcement composites retain their production actions", () => {
  const onImport = vi.fn();
  const onDismiss = vi.fn();
  const { rerender } = render(<ImportWorkflow title="Import Character Parts" detail="Review source files" destination="Atlas" files={[{ id: "head", name: "head.step", detail: "Millimeters" }]} options={["Copy into project"]} onImport={onImport} />);
  const workflow = screen.getByRole("region", { name: "Import Character Parts" });
  expect(within(workflow).getByText("head.step")).toBeTruthy();
  fireEvent.click(within(workflow).getByRole("button", { name: "Add 1 file" }));
  expect(onImport).toHaveBeenCalledOnce();

  rerender(<AnnouncementCard badge="New" title="Connect multiple controllers" detail="Route one character across output devices." onDismiss={onDismiss} />);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss announcement" }));
  expect(onDismiss).toHaveBeenCalledOnce();
});

test("agent layout has one composer and keeps settings out of the conversation", () => {
  const onSubmit = vi.fn();
  render(<AssistantPanel title="Aether Agent" layout="agent" messages={[]} status="Not connected" context={<span>Scene 1</span>} onSubmit={onSubmit}/>);
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "voice mode" })).toBeNull();
  expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  const input = screen.getByRole("textbox", { name: "Ask Aether Agent" });
  fireEvent.change(input, { target: { value: "Moving light\nKeep the windows dark" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(onSubmit).toHaveBeenCalledWith("Moving light\nKeep the windows dark");
  expect((input as HTMLTextAreaElement).value).toBe("");
});

test("advisor suggestions draft without sending and response ratings stay interactive", () => {
  const onSubmit = vi.fn(), onRate = vi.fn();
  const view = render(<AssistantPanel title="Aether Agent" heading="AI Advisor" layout="agent" messages={[]}
    suggestions={["Review this scene"]} onSubmit={onSubmit} onRate={onRate}/>);
  fireEvent.click(screen.getByRole("button", {name:"Review this scene"}));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Review this scene");
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
  expect(onSubmit).not.toHaveBeenCalled();
  view.rerender(<AssistantPanel title="Aether Agent" heading="AI Advisor" layout="agent"
    messages={[{id:"reply", role:"assistant", text:"Review the alignment."}]} onSubmit={onSubmit} onRate={onRate}/>);
  expect(screen.queryByText("Sample questions")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"Rate 4 of 5"}));
  expect(onRate).toHaveBeenCalledWith("reply", 4);
  expect(screen.getByRole("button", {name:"Rate 4 of 5"}).getAttribute("aria-pressed")).toBe("true");
});
