import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Avatar, ChoiceCard, PasswordField, TeamMembersPanel, FieldMappingForm, aetherThemes } from "./index";
import { WorkflowWidgetsDemo } from "../gallery/WorkflowWidgetsDemo";
import { sectionTab } from "../gallery/showcase";
afterEach(cleanup);

test("password reveal and avatar fallback keep their accessible identities", () => {
  render(<><PasswordField aria-label="Password" defaultValue="example-only" /><Avatar name="James Thomas" src="missing.png" /></>);
  expect(screen.getByLabelText("Password").getAttribute("type")).toBe("password");
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  const avatar = screen.getByRole("img", { name: "James Thomas" });
  fireEvent.error(avatar.querySelector("img")!);
  expect(avatar.textContent).toBe("JT");
});

test("choice cards retain native radio behavior and selected content", () => {
  function Example() { const [value, setValue] = useState("basic"); return <>{["basic", "pro"].map(id => <ChoiceCard key={id} name="plan" value={id} label={id} checked={value === id} onChange={setValue}><button>Choose {id}</button></ChoiceCard>)}</>; }
  render(<Example />);
  fireEvent.click(screen.getByRole("radio", { name: "pro" }));
  expect((screen.getByRole("radio", { name: "pro" }) as HTMLInputElement).checked).toBe(true);
  expect(screen.queryByRole("button", { name: "Choose basic" })).toBeNull();
  expect(screen.getByRole("button", { name: "Choose pro" })).toBeTruthy();
});

test("team credit editor rejects over-allocation and emits a bounded update", () => {
  const onCreditChange = vi.fn(), onInvite = vi.fn(), onRemove = vi.fn();
  render(<TeamMembersPanel members={[{ id: "1", name: "James Thomas", email: "james@example.com", credits: 1000 }, { id: "2", name: "Sophia Taylor", email: "sophia@example.com", credits: 4000 }]} totalCredits={5000} onCreditChange={onCreditChange} onInvite={onInvite} onRemove={onRemove} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit credits for James Thomas" }));
  const field = screen.getByRole("spinbutton", { name: "Monthly credit limit" });
  fireEvent.change(field, { target: { value: "1001" } });
  fireEvent.submit(field.closest("form")!);
  expect(onCreditChange).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: "500" } });
  fireEvent.submit(field.closest("form")!);
  expect(onCreditChange).toHaveBeenCalledWith("1", 500);
  expect(screen.queryByRole("dialog", { name: "Member credit limit" })).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Team member email" }), { target: { value: "new@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Invite" }));
  expect(onInvite).toHaveBeenCalledWith("new@example.com");
});

test("field mapping requires the required column before continuing", () => {
  const done = vi.fn();
  function Example() { const [value, setValue] = useState<Record<string, string>>({}); return <FieldMappingForm mode="list" onModeChange={() => {}} fileName="sample.csv" itemCount="2 rows" onUpdateFile={() => {}} fields={[{ id: "name", label: "Name", required: true }]} columns={["first_name"]} value={value} onChange={setValue} onContinue={done} />; }
  render(<Example />);
  expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole("combobox", { name: "Map Name" }), { target: { value: "first_name" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(done).toHaveBeenCalledOnce();
});

test("workflow specimens expose sign-up, imported structure and billing changes locally", () => {
  render(<WorkflowWidgetsDemo />);
  const auth = within(screen.getByRole("region", { name: "Log in to Aether" }));
  fireEvent.click(auth.getByRole("button", { name: "New here? Create account" }));
  const signup = within(screen.getByRole("region", { name: "Create an Aether account" }));
  expect(signup.getByRole("textbox", { name: "Full name" })).toBeTruthy();
  expect(signup.getByRole("checkbox", { name: "I agree to the privacy policy" })).toBeTruthy();
  const framework = within(screen.getByRole("region", { name: "Import framework" }));
  fireEvent.change(framework.getByRole("textbox", { name: "Example message" }), { target: { value: "Hello Alex\nOur platform helps your team." } });
  fireEvent.click(framework.getByRole("button", { name: "Import structure" }));
  expect(screen.getByText("Our platform helps your team.")).toBeTruthy();
  const plans = within(screen.getByRole("region", { name: "Subscription" }));
  fireEvent.click(plans.getByRole("radio", { name: "Bill monthly" }));
  expect(plans.getByText("$24 / month")).toBeTruthy();
  fireEvent.click(plans.getByRole("radio", { name: /Pro Personalized/ }));
  fireEvent.click(plans.getByRole("button", { name: "Subscribe" }));
  expect(screen.getByText(/pro selected · monthly/)).toBeTruthy();
});

test("sequence rename, duplicate and message actions update the standalone specimen", () => {
  render(<WorkflowWidgetsDemo />);
  const sequences = within(screen.getByRole("region", { name: "Sequences" }));
  fireEvent.click(sequences.getByRole("button", { name: "Options for Growth companies" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
  const field = sequences.getByRole("textbox", { name: "Sequence name" });
  fireEvent.change(field, { target: { value: "Engineering teams" } });
  fireEvent.submit(field.closest("form")!);
  fireEvent.click(sequences.getByRole("button", { name: "Options for Engineering teams" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
  expect(sequences.getByRole("button", { name: "Engineering teams copy" })).toBeTruthy();
  fireEvent.click(sequences.getByRole("button", { name: "New message" }));
  expect(sequences.getByText("New message")).toBeTruthy();
});

test("account edits save, cancel and update email through the standard dialog", () => {
  render(<WorkflowWidgetsDemo />);
  const account = within(screen.getByRole("region", { name: "Account settings" }));
  const name = account.getByRole("textbox", { name: "Your full name" }) as HTMLInputElement;
  fireEvent.change(name, { target: { value: "Updated name" } });
  fireEvent.click(account.getByRole("button", { name: "Cancel" }));
  expect(name.value).toBe("Gregory Murray");
  fireEvent.click(account.getByRole("button", { name: /Email gregory@example.com/ }));
  const dialog = within(screen.getByRole("dialog", { name: "Update email" }));
  fireEvent.change(dialog.getByRole("textbox", { name: "New email" }), { target: { value: "updated@example.com" } });
  fireEvent.click(dialog.getByRole("button", { name: "Confirm" }));
  expect(account.getByText("updated@example.com")).toBeTruthy();
});

test("Slate themes and every new element have canonical gallery homes", () => {
  const slate = aetherThemes.find(theme => theme.id === "aether-slate")!;
  expect(slate.modes.dark["color-bg-panel"]).toBe("#2b3032");
  expect(slate.modes.light["color-bg-panel"]).toBe("#ffffff");
  expect(slate.modes.dark["color-bg-segment-selected"]).toBe("#4b5154");
  for (const section of ["Avatars", "Password fields", "Choice cards", "Settings rows", "Structure steps"]) expect(sectionTab(section)).toBe("elements");
  expect(sectionTab("Workflow widgets — forms, lists and account controls")).toBe("widgets");
});
