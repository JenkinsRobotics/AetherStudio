// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { DocumentCollaborationPanel } from "./DocumentCollaborationPanel";
import { DocumentVersionPanel } from "./DocumentVersionPanel";
import type {
  DocumentCollaboration,
  DocumentConnection,
  DocumentHistory,
} from "./DocumentServices";
afterEach(cleanup);
const data = (): DocumentCollaboration => ({
  revision: 1,
  actor: "owner",
  owner: "owner",
  members: [{ id: "owner", name: "Owner" }],
  comments: [],
  notes: { text: "Original" },
  tasks: [],
  reminders: [],
  activity: [],
});
it("retains a notes draft and its original revision when polling sees someone else’s edit", async () => {
  let state = data();
  const mutations: Record<string, unknown>[] = [];
  const connection: DocumentConnection = {
    key: "map:file",
    name: "Show",
    flush: async () => {},
    reload: async () => {},
    async call<T>(action: string, args?: Record<string, unknown>) {
      if (action === "collaboration_mutate") {
        mutations.push(args!);
        if (args!.expected_revision !== state.revision)
          throw Object.assign(new Error("Changed elsewhere"), { status: 409 });
        state = {
          ...state,
          notes: args!.value as DocumentCollaboration["notes"],
          revision: state.revision + 1,
        };
      }
      return structuredClone(state) as T;
    },
  };
  render(<DocumentCollaborationPanel connection={connection} kind="notes" />);
  await screen.findByText("Original");
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Edit document notes" }));
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Document notes text") as HTMLTextAreaElement)
        .value,
    ).toBe("Original"),
  );
  fireEvent.change(screen.getByLabelText("Document notes text"), {
    target: { value: "My draft" },
  });
  state = { ...state, revision: 2, notes: { text: "Remote changes" } };
  fireEvent.click(screen.getByRole("button", { name: "Refresh document notes" }));
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Document notes text") as HTMLTextAreaElement)
        .value,
    ).toBe("My draft"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
  await screen.findByRole("group", { name: "Review conflicting edit" });
  expect(mutations[0].expected_revision).toBe(1);
  expect(screen.getByText("Remote changes")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Keep my draft after review" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save notes" }));
  await waitFor(() => expect(state.notes.text).toBe("My draft"));
  expect(mutations[1].expected_revision).toBe(2);
  await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  expect(screen.getByText("My draft")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit document notes" }));
  fireEvent.change(screen.getByLabelText("Document notes text"), {target:{value:"Discard me"}});
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByText("My draft")).toBeTruthy();
  expect(mutations).toHaveLength(2);
});
it("shows notes to other members without enabling editing and refreshes the reading view", async () => {
  let state = {...data(), actor:"reader"};
  const connection: DocumentConnection = {
    key:"notes:read-only", name:"Show", flush:async()=>{}, reload:async()=>{},
    call:async<T,>()=>structuredClone(state) as T,
  };
  render(<DocumentCollaborationPanel connection={connection} kind="notes" />);
  await screen.findByText("Original");
  expect((screen.getByRole("button", {name:"Edit document notes"}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("textbox")).toBeNull();
  state = {...state, revision:2, notes:{text:"Updated description"}};
  fireEvent.click(screen.getByRole("button", {name:"Refresh document notes"}));
  await screen.findByText("Updated description");
});
it("flushes the editor before naming the exact new branch head", async () => {
  let head = 2;
  const calls: string[] = [];
  const connection: DocumentConnection = {
    key: "map:show:Alternative",
    name: "Show",
    branch: "Alternative",
    flush: async () => {
      calls.push("flush");
      head = 3;
    },
    reload: async () => {},
    async call<T>(action: string, args?: Record<string, unknown>) {
      calls.push(action);
      if (action === "version") {
        expect(args).toMatchObject({
          branch: "Alternative",
          expected_revision: 3,
          name: "Ready",
        });
        return {} as T;
      }
      return {
        revisions: [],
        versions: [],
        branches: [{ name: "Alternative", head_revision: head }],
      } as DocumentHistory as T;
    },
  };
  render(<DocumentVersionPanel connection={connection} createOnly />);
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Ready" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create version" }));
  await waitFor(() => expect(calls).toContain("version"));
  expect(
    calls.slice(calls.indexOf("flush"), calls.indexOf("version") + 1),
  ).toEqual(["flush", "history", "version"]);
});
it("never presents writable history controls for read-only files", () => {
  const connection: DocumentConnection = {
    key: "shared",
    name: "Shared",
    writable: false,
    flush: vi.fn(),
    reload: vi.fn(),
    call: vi
      .fn()
      .mockResolvedValue({ revisions: [], versions: [], branches: [] }),
  };
  render(<DocumentVersionPanel connection={connection} createOnly />);
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Forbidden" },
  });
  expect(
    (
      screen.getByRole("button", {
        name: "Create version",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

it("shows a compact milestone graph; recovery saves and version forms require an explicit action", async () => {
  const history: DocumentHistory = {
    branches:[{name:"Main",head_revision:267}], versions:[],
    revisions:Array.from({length:267},(_,i)=>({revision:i+1,name:"Show",author:"Designer",saved:1000+i,event:i?"save":"create",note:"",branch:"Main",parent_revision:i||null,merge_parent_revision:null})).reverse(),
  };
  const call=vi.fn().mockResolvedValue(history);
  render(<DocumentVersionPanel connection={{key:"graph",name:"Show",flush:async()=>{},reload:async()=>{},call}} />);
  await screen.findByRole('button',{name:'Workspace Main'});
  expect(screen.getByRole('button',{name:'Document Start'})).toBeTruthy();
  expect(screen.queryByLabelText('Name')).toBeNull();
  expect(screen.queryByText(/Revision 267/)).toBeNull();
  expect(screen.queryByRole('list',{name:'Automatic saves'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'More history actions'}));
  fireEvent.click(screen.getByRole('menuitem',{name:'Automatic saves (recovery)'}));
  expect(screen.getByRole('list',{name:'Automatic saves'}).children).toHaveLength(267);
  expect(screen.getByText('Recovery snapshots, not versions or commits.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Back to versions'}));
  fireEvent.click(screen.getByRole('button',{name:'Create version'}));
  expect(screen.getByLabelText('Name')).toBeTruthy();
  expect(call.mock.calls.every(([action])=>action==='history')).toBe(true);
});

it("the creation panel offers two explicit actions and branches from the flushed head without a version or copy", async () => {
  const calls: string[]=[];
  let head=7;
  const connection: DocumentConnection={key:'create',name:'Show',flush:async()=>{calls.push('flush');head=8;},reload:async()=>{},saveCopy:vi.fn(),
    async call<T>(action:string,args?:Record<string,unknown>) {
      calls.push(action);
      if(action==='branch_create')expect(args).toMatchObject({name:'Experiment',message:'Try different lights',from_revision:8,expected_revision:8});
      return {branches:[{name:'Main',head_revision:head}],versions:[],revisions:[]} as T;
    }};
  render(<DocumentVersionPanel connection={connection} createOnly />);
  await waitFor(()=>expect(calls).toContain('history'));
  expect(screen.queryByRole('button',{name:/Refresh|copy/i})).toBeNull();
  expect(screen.getAllByRole('button').map(button=>button.textContent?.trim())).toEqual(['Create version','Create branch']);
  fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Experiment'}});
  fireEvent.change(screen.getByLabelText('Description'),{target:{value:'Try different lights'}});
  fireEvent.click(screen.getByRole('button',{name:'Create branch'}));
  await screen.findByText('Branch “Experiment” created.');
  expect(calls.slice(calls.indexOf('flush'),calls.indexOf('branch_create')+1)).toEqual(['flush','history','branch_create']);
  expect(calls).not.toContain('version');
  expect(connection.saveCopy).not.toHaveBeenCalled();
});

it("keeps create/branch together, all overflow commands have icons, and display tools never mutate history", async () => {
  const history: DocumentHistory={branches:[{name:"Main",head_revision:3},{name:"Experiment",head_revision:2}],versions:[{name:"Review",revision:2,message:"Ready",status:"candidate"}],
    revisions:[3,2,1].map(revision=>({revision,name:"Show",author:"Designer",saved:1000+revision,event:revision===1?"create":"save",note:"",branch:"Main",parent_revision:revision===1?null:revision-1,merge_parent_revision:null}))};
  const call=vi.fn().mockResolvedValue(history);
  render(<DocumentVersionPanel connection={{key:"controls",name:"Show",call,flush:async()=>{},reload:async()=>{}}}/>);
  await screen.findByRole("button",{name:"Workspace Main"});
  const header=document.querySelector('.aui-version-head')!;
  expect([...header.querySelectorAll('button')].map(b=>b.getAttribute('aria-label'))).toEqual(['Create version','Create branch','More history actions']);
  fireEvent.click(screen.getByRole('button',{name:'More history actions'}));
  const menu=screen.getByRole('menu',{name:'History actions'});
  expect(menu.querySelectorAll('[role="menuitem"] svg').length).toBe(menu.querySelectorAll('[role="menuitem"]').length);
  expect(menu.querySelector('[data-icon-missing]')).toBeNull();
  expect(screen.getByRole('menuitem',{name:'Compare entries'})).toBeTruthy();
  fireEvent.keyDown(menu,{key:'Escape'});
  fireEvent.click(screen.getByRole('button',{name:'Filter branches'}));
  fireEvent.click(screen.getByRole('menuitemradio',{name:'Show current branch'}));
  expect(screen.queryByRole('button',{name:'Workspace Experiment'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Show changes for Main'}));
  expect(screen.getByRole('list',{name:'Changes for Main'}).children).toHaveLength(1);
  expect(document.querySelector('.aui-version-legend')?.textContent).toBe('WorkspaceVersionChangeRelease candidateReleaseContains obsoletionAutomatic version');
  expect(call.mock.calls.every(([action])=>action==='history')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Create branch'}));
  const dialog=await screen.findByRole('dialog',{name:'Create branch from Main'});
  expect(dialog.querySelector('[data-icon="branch-from"]')).toBeTruthy();
});

it("comments use flat threads, compact controls and retain drafts when another edit arrives", async () => {
  let state = data();
  state.comments=[{id:'root',text:'Original comment',author:'owner',created:1000,updated:1000,branch:'Main',resolved:false}];
  const connection:DocumentConnection={key:'comment-layout',name:'Part',flush:async()=>{},reload:async()=>{},
    async call<T>(action:string,args?:Record<string,unknown>){
      if(action==='history')return {branches:[{name:'Main',head_revision:1}],versions:[],revisions:[]} as T;
      if(action==='collaboration_mutate'){
        if(args?.expected_revision!==state.revision)throw Object.assign(new Error('Changed elsewhere'),{status:409});
        state={...state,revision:state.revision+1,comments:state.comments.map(i=>i.id===args?.item?{...i,...args?.value as object,updated:1002}:i)};
      }
      return structuredClone(state) as T;
    }};
  render(<DocumentCollaborationPanel connection={connection} kind="comments"/>);
  await screen.findByText('Original comment');
  expect(screen.queryByRole('button',{name:'Refresh'})).toBeNull();
  expect((screen.getByLabelText('Comments filter') as HTMLSelectElement).value).toBe('all');
  expect(screen.getByRole('button',{name:'Attach screenshot'})).toBeTruthy();
  expect(document.querySelector('[data-icon-missing]')).toBeNull();
  fireEvent.change(screen.getByLabelText('Comments text'),{target:{value:'Unsent'}});
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  expect((screen.getByLabelText('Comments text') as HTMLTextAreaElement).value).toBe('');
  fireEvent.click(screen.getByRole('button',{name:'Comment actions'}));
  fireEvent.click(screen.getByRole('menuitem',{name:'Edit comment'}));
  fireEvent.change(screen.getByLabelText('Comments text'),{target:{value:'My edit'}});
  state={...state,revision:2,comments:[{...state.comments[0],text:'Remote edit',updated:1001}]};
  fireEvent.click(screen.getByRole('button',{name:'Save'}));
  await screen.findByRole('group',{name:'Review conflicting edit'});
  expect((screen.getByLabelText('Comments text') as HTMLTextAreaElement).value).toBe('My edit');
  fireEvent.click(screen.getByRole('button',{name:'Use latest text'}));
  expect((screen.getByLabelText('Comments text') as HTMLTextAreaElement).value).toBe('Remote edit');
});

it("action item filters combine tasks and reminders while mutations retain their collection", async () => {
  let state: DocumentCollaboration = {...data(),
    tasks:[{id:'task',text:'Review design',author:'owner',assignee:'owner',created:1,updated:1,status:'open'}],
    reminders:[{id:'reminder',text:'Call supplier',author:'owner',assignee:'owner',created:2,updated:2,status:'open',due:'2026-01-01'}],
  };
  const mutations: Record<string, unknown>[]=[];
  const connection: DocumentConnection={key:'actions:one',name:'Show',flush:async()=>{},reload:async()=>{},
    async call<T>(action:string,args?:Record<string,unknown>){
      if(action==='collaboration_mutate'){
        mutations.push(args!);
        const collection=args!.collection as 'tasks'|'reminders';
        state={...state,revision:state.revision+1,[collection]:state[collection].map(item=>item.id===args!.item?{...item,...args!.value as object,updated:item.updated+1}:item)};
      }
      return structuredClone(state) as T;
    }};
  render(<DocumentCollaborationPanel connection={connection} kind="tasks"/>);
  await screen.findByText('Review design');
  expect(screen.getByText('Call supplier')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Action item type'),{target:{value:'reminders'}});
  expect(screen.queryByText('Review design')).toBeNull();
  fireEvent.change(screen.getByLabelText('Status for Call supplier'),{target:{value:'done'}});
  await waitFor(()=>expect(mutations).toHaveLength(1));
  expect(mutations[0]).toMatchObject({collection:'reminders',item:'reminder',value:{status:'done'}});
  await waitFor(()=>expect((screen.getByLabelText('Status for Call supplier') as HTMLSelectElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Actions for Call supplier'}));
  fireEvent.click(screen.getByRole('menuitem',{name:'Edit item'}));
  const dialog=screen.getByRole('dialog',{name:'Edit action item'});
  fireEvent.change(within(dialog).getByLabelText('Action items text'),{target:{value:'Call supplier tomorrow'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(mutations[1]).toMatchObject({collection:'reminders',item:'reminder',value:{text:'Call supplier tomorrow'}});
  fireEvent.change(screen.getByLabelText('Search in Action items'),{target:{value:'does not exist'}});
  expect(screen.getByText('No action items found for the current filter.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Clear action item filters'}));
  expect(screen.getByText('Review design')).toBeTruthy();
  expect(screen.getByText('Call supplier tomorrow')).toBeTruthy();
});
