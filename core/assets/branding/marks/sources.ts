/** Standalone A artwork; ordinary asset imports work in development and production bundlers. */
import studio from "./studio.png";
import cad from "./cad.png";
import animation from "./animation.png";
import ui from "./ui.png";
import map from "./map.png";
import sketch from "./sketch.png";
import vector from "./vector.png";
import io from "./io.png";
import drive from "./drive.png";

/** Separate resources: only displayed marks are fetched by the browser. */
export const appMarkSources = {
  studio,
  cad,
  animation,
  ui,
  map,
  sketch,
  vector,
  io,
  drive,
} as const;

export type AppMarkName = keyof typeof appMarkSources;
