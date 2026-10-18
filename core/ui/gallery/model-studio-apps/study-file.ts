import { finiteTuple, validateItems } from "../demo-document/document";
import { studies, type StudyApp, type StudyItem } from "./studies";

export function validateStudyItems(value: unknown, app: StudyApp): StudyItem[] {
  validateItems(value);
  return value.map(item => {
    const original = studies[app].items.find(source => source.id === item.id);
    const added = Number.isSafeInteger(Number(String(item.id).slice(6))) && Number(String(item.id).slice(6)) <= 1000000 && app === "sketch" && /^shape-\d+$/.test(String(item.id)) && ["Circle", "Rectangle"].includes(String(item.kind));
    if ((!original && !added) || !finiteTuple([item.x, item.y], 2) || typeof item.opacity !== "number" || !Number.isFinite(item.opacity) || item.opacity < 0 || item.opacity > 100 || typeof item.weight !== "number" || !Number.isFinite(item.weight) || item.weight < .5 || item.weight > 12)
      throw Error("The study contains invalid object geometry or appearance.");
    return { id: String(item.id), name: String(item.name), color: String(item.color), visible: Boolean(item.visible), x: item.x as number, y: item.y as number, opacity: item.opacity, weight: item.weight,
      kind: original?.kind ?? String(item.kind), bounds: original?.bounds ?? (item.kind === "Circle" ? [435,285,130,130] : [425,300,150,100]) };
  });
}
