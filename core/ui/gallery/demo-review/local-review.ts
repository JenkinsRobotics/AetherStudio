import type { CollaborationItem, DocumentCollaboration, DocumentConnection } from "../../src";

/** Window-local showcase adapter for the standard document widgets. No transport. */
export function localReview(context: () => { name: string; selected?: string }, seed?: DocumentCollaboration): DocumentConnection {
  let state: DocumentCollaboration = seed ? structuredClone(seed) : {
    revision: 1, actor: "local", owner: "local", members: [{ id: "local", name: "You" }],
    comments: [], tasks: [], reminders: [], notes: { text: "" }, activity: [],
  };
  return {
    key: `demo-review:${crypto.randomUUID()}`,
    get name() { return context().name; },
    branch: "Main", writable: true,
    flush: async () => {}, reload: async () => {},
    async call<T>(action: string, data: Record<string, unknown> = {}) {
      if (action === "history") return { revisions: [], versions: [], branches: [], writable: false } as T;
      if (action === "collaboration") return structuredClone(state) as T;
      if (action !== "collaboration_mutate") throw new Error("This action needs a connected Studio document.");
      if (data.expected_revision !== state.revision) throw new Error("This local review changed. Try again.");
      const collection = data.collection;
      if (collection !== "comments" && collection !== "tasks" && collection !== "reminders") throw new Error("Unsupported review collection.");
      const value = data.value as Partial<CollaborationItem>, now = Date.now() / 1000;
      const id = String(data.item ?? crypto.randomUUID());
      if (data.operation === "add") {
        state = { ...state, [collection]: [...state[collection], {
          ...value, id, text: value.text ?? "", author: "local", assignee: value.assignee || "local",
          created: now, updated: now, status: value.status ?? "open", resolved: false,
          ...(collection === "comments" && !value.parent ? { reference_name: context().selected || context().name } : {}),
        }] };
      } else if (data.operation === "update" || data.operation === "delete") {
        if (!state[collection].some(item => item.id === id)) throw new Error("This review item no longer exists.");
        state = { ...state, [collection]: state[collection].map(item => item.id !== id ? item : {
          ...item, ...value, id: item.id, author: item.author, created: item.created, updated: Math.max(now, item.updated + .001),
          ...(data.operation === "delete" ? { deleted: true, text: "" } : {}),
        }) };
      } else throw new Error("Unsupported review operation.");
      state = { ...state, revision: state.revision + 1 };
      return structuredClone(state) as T;
    },
  };
}
