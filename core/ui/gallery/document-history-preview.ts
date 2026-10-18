import type { DocumentConnection } from "../src/DocumentServices";

/** Existing read-only showcase data; never represents a model's undo stack. */
export const documentHistoryPreview: DocumentConnection = {
  key: "showcase:history",
  name: "Prototype",
  writable: false,
  flush: async () => {},
  reload: async () => {},
  async call<T>(action: string, data: Record<string, unknown> = {}) {
    if (action === "history")
      return {
        writable: false,
        branches: [{ name: "Main", head_revision: 8 }, {name:"Experiment",head_revision:7}],
        versions: [
          { name: "Prototype 1", revision: 2, message: "Initial review" },
          { name: "Connector retired", revision: 3, message: "Replaced connector", status:"obsolete", status_note:"Superseded by the new connector" },
          { name: "Production release", revision: 4, message: "Approved document", status:"released" },
          { name: "Review candidate", revision: 5, message: "Awaiting review", status:"candidate" },
          { name: "Merge checkpoint", revision: 6, message: "Explicit merge", origin:"automatic" },
          { name: "Alternative", revision: 7, message: "Trial layout", branch:"Experiment" },
        ],
        revisions: [8,7,6,5,4,3,2,1].map((revision) => ({
          revision,
          name: "Prototype",
          saved: 1791043200 + revision * 60,
          author: "Designer",
          event: revision === 1 ? "create" : "save",
          note: "",
          branch: revision === 7 ? "Experiment" : "Main",
          parent_revision: revision === 1 ? null : revision === 8 ? 6 : revision === 7 ? 4 : revision - 1,
          merge_parent_revision: null,
        })),
      } as T;
    if (action === "compare")
      return {
        same_content: false,
        content_diff: {
          text: "- connector: left\n+ connector: right",
          truncated: false,
        },
      } as T;
    if (action === "read_revision")
      return {
        name: "prototype.json",
        data_base64: btoa(JSON.stringify({ revision: data.revision })),
      } as T;
    throw new Error("This history example is read only.");
  },
};
