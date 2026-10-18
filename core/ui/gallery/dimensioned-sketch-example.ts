import type { SketchAnnotationPoint, SketchConstraintAnnotation, SketchDimensionAnnotation, SketchPresentationEntity } from "../src/DimensionedSketch";

export const SKETCH_PARAMETERS = [
  { id: "RcapE", label: "Cap radius", value: 25.14, min: 23, max: 28 },
  { id: "blankOD", label: "Blank diameter", value: 44.56, min: 36, max: 48 },
  { id: "Ework", label: "Working radius", value: 6.65, min: 5, max: 9 },
  { id: "Rseat", label: "Seat radius", value: 2.59, min: 1.5, max: 4 },
  { id: "Mc", label: "Center offset", value: 3.13, min: 1, max: 4.5 },
  { id: "Rp", label: "Pitch height", value: 19.90, min: 17, max: 21 },
] as const;
export type SketchParameterID = typeof SKETCH_PARAMETERS[number]["id"];
export type SketchSampleValues = Record<SketchParameterID, number>;
export interface SketchSampleState {
  values: SketchSampleValues;
  labels: Record<string, SketchAnnotationPoint>;
  notes: Record<string, string>;
}
export function initialSketchSample(): SketchSampleState {
  return { values: Object.fromEntries(SKETCH_PARAMETERS.map(p => [p.id, p.value])) as SketchSampleValues, labels: {}, notes: {} };
}

/** Validation for this bounded illustration only. CAD supplies solved geometry
 * to the shared surface in production; this is not a CAD constraint solver. */
export function sketchSampleProblem(values: SketchSampleValues): string | null {
  for (const p of SKETCH_PARAMETERS) {
    if (!Number.isFinite(values[p.id]) || values[p.id] < p.min || values[p.id] > p.max) return `${p.label} must be between ${p.min} and ${p.max} mm.`;
  }
  if (values.Ework - values.Rseat <= values.Mc + .15) return "Working radius must exceed seat radius + center offset + 0.15 mm.";
  const rise = Math.sqrt((values.Ework - values.Rseat) ** 2 - values.Mc ** 2);
  const shoulderY = values.Rp + rise - values.Ework * Math.sin(Math.PI / 18);
  const shoulderX = -values.Mc + values.Ework * Math.cos(Math.PI / 18);
  if (shoulderX <= 1 || shoulderX >= 5.1) return "These radii put a shoulder outside the sample profile. Adjust the working radius or center offset.";
  if (Math.sqrt(values.RcapE ** 2 - 5.3 ** 2) <= shoulderY + .5) return "The cap must remain at least 0.5 mm above the shoulders. Increase cap radius or reduce pitch height.";
  return null;
}

export const DIMENSION_PARAMETER: Record<string, SketchParameterID> = {
  cap: "RcapE", blank: "blankOD", "work-left": "Ework", "work-right": "Ework", seat: "Rseat", offset: "Mc", pitch: "Rp",
};
export const SAMPLE_VIEW = { width: 900, height: 800 };

/** Analytic SVG fixture: two internally tangent circles meet the seat, a
 * circular cap closes the profile and the blank is a construction circle.
 * The handful of direct circle calculations exist only to exercise live UI;
 * they do not validate engineering standards, solve constraints or save CAD. */
export function dimensionedSketchSample(state: SketchSampleState) {
  const v = state.values, scale = 24;
  const p = (x: number, y: number): SketchAnnotationPoint => [450 + x * scale, 710 - y * scale];
  const at = ([x, y]: SketchAnnotationPoint) => `${x.toFixed(3)} ${y.toFixed(3)}`;
  const circleGap = v.Ework - v.Rseat;
  const rise = Math.sqrt(circleGap ** 2 - v.Mc ** 2);
  const tangentX = v.Rseat * v.Mc / circleGap, tangentY = v.Rp - v.Rseat * rise / circleGap;
  const shoulderX = -v.Mc + v.Ework * Math.cos(Math.PI / 18), shoulderY = v.Rp + rise - v.Ework * Math.sin(Math.PI / 18);
  const capY = Math.sqrt(v.RcapE ** 2 - 5.3 ** 2);
  const center = p(0, v.Rp), origin = p(0, 0);
  const capLeft = p(-5.3, capY), capRight = p(5.3, capY);
  const shoulderLeft = p(-shoulderX, shoulderY), shoulderRight = p(shoulderX, shoulderY);
  const tangentLeft = p(-tangentX, tangentY), tangentRight = p(tangentX, tangentY);
  const workCenterLeft = p(v.Mc, v.Rp + rise), workCenterRight = p(-v.Mc, v.Rp + rise);
  const seatBottom = p(0, v.Rp - v.Rseat), capTop = p(0, v.RcapE);
  const blankRadius = v.blankOD / 2, blankX = blankRadius * Math.sin(Math.PI / 5), blankY = blankRadius * Math.cos(Math.PI / 5);
  const entities: SketchPresentationEntity[] = [
    { id: "blank", label: "Blank construction arc", construction: true, path: `M${at(p(-blankX, blankY))} A${blankRadius * scale} ${blankRadius * scale} 0 0 1 ${at(p(blankX, blankY))}` },
    { id: "centerline", label: "Vertical construction centerline", construction: true, path: `M${at(origin)} L${at(capTop)}` },
    { id: "rays", label: "Construction rays to cap endpoints", construction: true, path: `M${at(capLeft)} L${at(origin)} L${at(capRight)}` },
    { id: "cap", label: "Cap arc", path: `M${at(capLeft)} A${v.RcapE * scale} ${v.RcapE * scale} 0 0 1 ${at(capRight)}` },
    { id: "side-left", label: "Left shoulder line", path: `M${at(capLeft)} L${at(shoulderLeft)}` },
    { id: "side-right", label: "Right shoulder line", path: `M${at(capRight)} L${at(shoulderRight)}` },
    { id: "work-left", label: "Left working arc", path: `M${at(shoulderLeft)} A${v.Ework * scale} ${v.Ework * scale} 0 0 0 ${at(tangentLeft)}` },
    { id: "work-right", label: "Right working arc", path: `M${at(tangentRight)} A${v.Ework * scale} ${v.Ework * scale} 0 0 0 ${at(shoulderRight)}` },
    { id: "seat", label: "Seat arc", path: `M${at(tangentLeft)} A${v.Rseat * scale} ${v.Rseat * scale} 0 0 0 ${at(tangentRight)}` },
  ];
  const line = (from: SketchAnnotationPoint, to: SketchAnnotationPoint, arrows?: "both" | "end", extension = false) => ({ from, to, arrows, extension });
  const dimensions: SketchDimensionAnnotation[] = [
    { id: "offset", label: "Center offset", value: v.Mc.toFixed(2), reference: "@expr.Mc", entityIDs: ["work-left", "work-right"], position: [412, 27], anchor: [412, 62], lines: [line(workCenterRight, [workCenterRight[0], 62], undefined, true), line(center, [450, 62], undefined, true), line([workCenterRight[0], 62], [450, 62], "both")] },
    { id: "cap", label: "Cap radius", value: `R${v.RcapE.toFixed(2)}`, reference: "@expr.RcapE", accent: true, entityIDs: ["cap"], position: [625, 77], anchor: capTop, lines: [line(origin, capTop, "end")] },
    { id: "blank", label: "Blank diameter", value: `Ø${v.blankOD.toFixed(2)}`, reference: "@expr.blankOD", accent: true, entityIDs: ["blank"], position: [766, 165], anchor: p(blankX * .86, Math.sqrt(blankRadius ** 2 - (blankX * .86) ** 2)), lines: [] },
    { id: "work-left", label: "Left working radius", value: `R${v.Ework.toFixed(2)}`, reference: "@expr.Ework", entityIDs: ["work-left"], position: [265, 263], anchor: tangentLeft, lines: [line(workCenterLeft, tangentLeft, "end")] },
    { id: "work-right", label: "Right working radius", value: `R${v.Ework.toFixed(2)}`, reference: "@expr.Ework", entityIDs: ["work-right"], position: [627, 318], anchor: tangentRight, lines: [line(workCenterRight, tangentRight, "end")] },
    { id: "seat", label: "Seat radius", value: `R${v.Rseat.toFixed(2)}`, reference: "@expr.Rseat", entityIDs: ["seat"], position: [310, 357], anchor: seatBottom, lines: [line(center, seatBottom, "end")] },
    { id: "horizontal", label: "Tangent horizontal distance", value: tangentX.toFixed(2), reference: "@expr.yH", readOnly: true, entityIDs: ["seat", "work-right"], position: [492, 380], anchor: [450 + tangentX * scale / 2, 351], lines: [line(center, [450, 352], undefined, true), line(tangentRight, [tangentRight[0], 352], undefined, true), line([450, 352], [tangentRight[0], 352], "both")] },
    { id: "vertical", label: "Tangent vertical distance", value: (v.Rp - tangentY).toFixed(2), reference: "@expr.Vb", readOnly: true, entityIDs: ["seat", "work-right"], position: [768, 254], anchor: [672, (center[1] + tangentRight[1]) / 2], lines: [line(center, [675, center[1]], undefined, true), line(tangentRight, [675, tangentRight[1]], undefined, true), line([675, center[1]], [675, tangentRight[1]], "both")] },
    { id: "pitch", label: "Pitch height", value: v.Rp.toFixed(2), reference: "@expr.Rp", accent: true, entityIDs: ["seat", "centerline"], position: [105, 483], anchor: [180, 483], lines: [line(center, [175, center[1]], undefined, true), line(origin, [175, 710], undefined, true), line([180, center[1]], [180, 710], "both")] },
  ].map(d => ({ ...d, position: state.labels[d.id] ?? d.position })) as SketchDimensionAnnotation[];
  const constraints: SketchConstraintAnnotation[] = [
    { id: "tangent-left", label: "Tangent: left working arc and seat", glyph: "T", entityIDs: ["work-left", "seat"], position: [tangentLeft[0] - 22, tangentLeft[1] + 25] },
    { id: "tangent-right", label: "Tangent: right working arc and seat", glyph: "T", entityIDs: ["work-right", "seat"], position: [tangentRight[0] + 22, tangentRight[1] + 25] },
    { id: "vertical", label: "Vertical: construction centerline", glyph: "V", entityIDs: ["centerline"], position: [476, 561] },
  ];
  return { entities, dimensions, constraints, vertices: [capLeft, capRight, shoulderLeft, shoulderRight, tangentLeft, tangentRight, center, workCenterLeft, workCenterRight], origin,
    measured: { yH: tangentX, Vb: v.Rp - tangentY } };
}
