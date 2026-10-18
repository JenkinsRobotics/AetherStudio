import type { CollaborationItem, DocumentCollaboration } from "../../src";

/** Illustrative local review, never uploaded or added to a product document. */
export function modelReviewSeed(): DocumentCollaboration {
  const at = (minutes: number) => new Date(2026, 9, 17, 15, minutes).getTime() / 1000;
  const comment = (id: string, text: string, author: string, minutes: number, extra: Partial<CollaborationItem> = {}): CollaborationItem => ({ id, text, author, created: at(minutes), updated: at(minutes), branch: "Main", ...extra });
  const task = (id: string, text: string, reference_name: string, assignee: string, due: string, status: CollaborationItem["status"]): CollaborationItem => ({ id, text, reference_name, assignee, due, status, author: "local", created: at(40), updated: at(40) });
  return {
    revision: 1, actor: "local", owner: "local",
    members: [{ id: "local", name: "You" }, { id: "lindsay", name: "Lindsay" }, { id: "devon", name: "Devon" }],
    comments: [
      comment("wall-review", "Can we reduce this wall thickness to 2.5 mm?", "local", 18, { reference_name: "Main body" }),
      comment("clearance-review", "Looks good. Check clearance with the bracket.", "lindsay", 24, { reference_name: "Mount bracket" }),
      comment("version-review", "Updated. Here’s the new version.", "local", 32, { revision: 12 }),
      comment("approved-review", "Perfect. Ready for the next review.", "lindsay", 35),
    ],
    tasks: [
      task("wall-task", "Reduce wall thickness", "Main body", "local", "2026-10-17", "open"),
      task("bracket-task", "Check bracket clearance", "Mount bracket", "lindsay", "2026-10-18", "in_progress"),
      task("drawing-task", "Update drawing views", "Engineering drawings", "local", "2026-10-20", "open"),
      task("fea-task", "Run FEA on new design", "Simulation", "devon", "2026-10-21", "in_progress"),
      task("fastener-task", "Review fastener size", "Main assembly", "lindsay", "2026-10-15", "done"),
      task("thermal-task", "Run thermal analysis", "Simulation", "local", "2026-10-24", "open"),
    ],
    reminders: [], notes: { text: "" }, activity: [],
  };
}
