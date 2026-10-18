/// <reference types="vite/client" />
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DriveMembers } from "./library/members";
import { driveRequest } from "./library/drive-api";
vi.mock("./library/drive-api", () => ({ driveRequest: vi.fn() }));
// Exercise membership decisions independently of the UI package's CSS bundler.
vi.mock("@aether/ui", () => ({
 Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
 Dialog: ({title, children, actions}: {title: string; children: React.ReactNode; actions: React.ReactNode}) => <div role="dialog" aria-label={title}>{children}{actions}</div>,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const context = { organizations: [], workspaces: [], apps: [], user: {id:"admin",username:"admin",name:"Admin",admin:true} };
test("workspace access guard uses the saved assignment rather than inherited ownership", async () => {
 vi.mocked(driveRequest).mockResolvedValue({members:[{id:"person",username:"person.name",name:"Person",role:"owner",workspace_role:"owner",assigned_workspace_role:null}]});
 render(<DriveMembers context={context} organization="company" workspace="team" onClose={()=>{}} onChanged={()=>{}} />);
 await screen.findByRole("option",{name:"Person"});
 fireEvent.change(screen.getByRole("combobox",{name:"Member"}),{target:{value:"person"}});
 fireEvent.click(screen.getByRole("button",{name:"Apply access"}));
 await waitFor(()=>expect(driveRequest).toHaveBeenCalledWith("member_update",{organization:"company",workspace:"team",user:"person",role:"editor",expected_role:null}));
});
test("organization role changes guard the account selected by username",async()=>{
 vi.mocked(driveRequest).mockResolvedValue({members:[{id:"person-id",username:"person.name",name:"Person",role:"member"}]});
 render(<DriveMembers context={context} organization="company" onClose={()=>{}} onChanged={()=>{}} />);
 await screen.findByText("Person · member");
 fireEvent.change(screen.getByRole("textbox",{name:"Username"}),{target:{value:"person.name"}});
 fireEvent.change(screen.getByRole("combobox",{name:"Member role"}),{target:{value:"remove"}});
 fireEvent.click(screen.getByRole("button",{name:"Apply access"}));
 await waitFor(()=>expect(driveRequest).toHaveBeenCalledWith("member_update",{organization:"company",workspace:undefined,user:"person.name",role:"remove",expected_role:"member"}));
});
