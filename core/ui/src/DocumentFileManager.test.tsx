import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {expect,test,vi} from "vitest";
import {DocumentFileManager} from "./DocumentFileManager";
import type {DocumentConnection} from "./DocumentServices";

function fixture() {
  const call=vi.fn(async(_action:string,data:Record<string,unknown>)=>({files:data.parent ? [{id:"file",name:"Wheel",kind:"file",versions:2,latest_version:"Review"}] : [{id:"folder",name:"Designs",kind:"folder"}]}));
  const connection={key:"map:1",name:"Show",call,flush:vi.fn(),reload:vi.fn(),openDocument:vi.fn()} as unknown as DocumentConnection;
  return {connection,call};
}
test("browses folders, opens files through the session and reports navigation failure",async()=>{
  const {connection,call}=fixture();
  vi.mocked(connection.openDocument!).mockRejectedValue(new Error("Save conflict; keep your edits"));
  render(<DocumentFileManager connection={connection}/>);
  fireEvent.click(await screen.findByRole("button",{name:/Designs/}));
  fireEvent.click(await screen.findByRole("button",{name:/Wheel/}));
  expect(connection.openDocument).toHaveBeenCalledWith("file");
  expect((await screen.findByRole("alert")).textContent).toContain("Save conflict");
  fireEvent.click(screen.getByRole("button",{name:"My files"}));
  await screen.findByRole("button",{name:/Designs/});
  fireEvent.change(screen.getByLabelText("File library"),{target:{value:"workspace"}});
  await waitFor(()=>expect(call).toHaveBeenLastCalledWith("list",{view:"workspace",parent:null}));
});
test("selecting document contents uses the product adapter, not file navigation",async()=>{
  const {connection}=fixture(),onOpenItem=vi.fn();
  render(<DocumentFileManager connection={connection} onOpenItem={onOpenItem} documentGroups={[{id:"scenes",label:"Scenes",items:[{id:"s1",name:"Scene 1",kind:"scene"}]}]}/>);
  fireEvent.click(screen.getByRole("button",{name:"Scene 1"}));
  expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({id:"s1"}));
  expect(connection.openDocument).not.toHaveBeenCalled();
  await screen.findByRole("button",{name:/Designs/});
});
