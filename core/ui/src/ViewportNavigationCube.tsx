import { ViewportCubeScene } from "./ViewportCubeScene";
import { useId, useState } from "react";
import { cubeAxisOccluders } from "./viewport-cube-occlusion";
import arrow0 from "@aether/assets/icons/navigation/roll-left.svg?raw";
import arrow1 from "@aether/assets/icons/navigation/roll-right.svg?raw";
import arrow2 from "@aether/assets/icons/navigation/up.svg?raw";
import arrow3 from "@aether/assets/icons/navigation/left.svg?raw";
import arrow4 from "@aether/assets/icons/navigation/right.svg?raw";
import arrow5 from "@aether/assets/icons/navigation/down.svg?raw";
import { viewportCubeRegionsForUpAxis, viewportCubeColorTokens, type ViewportUpAxis, type CubeVector, type CubeFaceView } from "./viewport-cube-geometry";
import "./ViewportNavigationCube.css";
import { ViewportCubeHome } from "./ViewportCubeHome";
import type { MenuItem } from "./Menu";

export type ViewportOrientation = readonly [
  x: number,
  y: number,
  z: number,
  w: number,
];

export type StandardViewportView = CubeFaceView;

export interface ViewportNavigationCubeProps {
  orientation: ViewportOrientation;
  upAxis?: ViewportUpAxis;
  id?: string;
  className?: string;
  onSelectView: (view: StandardViewportView) => void;
  onSelectDirection?: (direction: CubeVector) => void;
  onFit: () => void;
  homeMenuItems?: readonly MenuItem[];
  onHomeMenuSelect?: (id: string) => void;
  onNudge: (horizontalSteps: number, verticalSteps: number) => void;
  onRoll: (quarterTurns: number) => void;
}

type Vector3 = readonly [number, number, number];
const point = (x: number, y: number, z: number): Vector3 => [x, y, z];

function normalizedOrientation([x, y, z, w]: ViewportOrientation): ViewportOrientation {
  const length = Math.hypot(x, y, z, w) || 1;
  return [x / length, y / length, z / length, w / length];
}

function rotateIntoCamera(vector: Vector3, orientation: ViewportOrientation): Vector3 {
  const [sourceX, sourceY, sourceZ, sourceW] = normalizedOrientation(orientation);
  const x = -sourceX;
  const y = -sourceY;
  const z = -sourceZ;
  const [vx, vy, vz] = vector;
  const dot = x * vx + y * vy + z * vz;
  const crossX = y * vz - z * vy;
  const crossY = z * vx - x * vz;
  const crossZ = x * vy - y * vx;
  const scalar = sourceW * sourceW - x * x - y * y - z * z;
  return [
    2 * dot * x + scalar * vx + 2 * sourceW * crossX,
    2 * dot * y + scalar * vy + 2 * sourceW * crossY,
    2 * dot * z + scalar * vz + 2 * sourceW * crossZ,
  ];
}

/** Retained as the renderer-independent quaternion projection helper used by
 * camera presentation stores. */
export function viewportCubeTransform(orientation: ViewportOrientation): string {
  let [x, y, z, w] = normalizedOrientation(orientation);
  x = -x;
  y = -y;
  z = -z;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  const matrix = [
    1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
    2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
    2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
    0, 0, 0, 1,
  ];
  return `matrix3d(${matrix.join(",")})`;
}

const project = ([x, y]: Vector3): readonly [number, number] => [46 + x * 21, 46 - y * 21];

function centroid(points: readonly (readonly [number, number])[]): readonly [number, number] {
  const [x, y] = points.reduce(
    ([sumX, sumY], [pointX, pointY]) => [sumX + pointX, sumY + pointY],
    [0, 0],
  );
  return [Number((x / points.length).toFixed(6)), Number((y / points.length).toFixed(6))];
}

/** Shared suite ViewCube, visually aligned with the native Studio projection.
 * Applications retain camera behavior and pass typed intent callbacks. */
export function ViewportNavigationCube({
  orientation,
  upAxis = "y",
  id,
  className,
  onSelectView,
  onSelectDirection,
  onFit,
  homeMenuItems,
  onHomeMenuSelect,
  onNudge,
  onRoll,
}: ViewportNavigationCubeProps) {
  const [sceneReady, setSceneReady] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const maskPrefix = useId().replaceAll(":", "");
  const classes = ["aui-viewport-cube"];
  if (className) classes.push(className);
  if (sceneReady) classes.push("aui-viewport-cube--3d");
  const projections = viewportCubeRegionsForUpAxis(upAxis)
    .map((face) => {
      const normal = rotateIntoCamera(face.normal, orientation);
      const vertices = face.vertices.map((vertex) => rotateIntoCamera(vertex, orientation));
      return {
        ...face,
        cameraVertices: vertices,
        facing: normal[2],
        depth: vertices.reduce((sum, vertex) => sum + vertex[2], 0) / vertices.length,
        points: vertices.map(project),
      };
    })
    .filter((face) => face.facing > 1e-9)
    .sort((first, second) => first.depth - second.depth);
  const axisOrigin = rotateIntoCamera(point(-1.15, -1.15, -1.15), orientation);
  const axes = [
    { id: "x", end: rotateIntoCamera(point(1.2, -1.15, -1.15), orientation) },
    { id: "y", end: rotateIntoCamera(point(-1.15, 1.2, -1.15), orientation) },
    { id: "z", end: rotateIntoCamera(point(-1.15, -1.15, 1.2), orientation) },
  ] as const;
  const [axisX, axisY] = project(axisOrigin);
  const facets = projections.map(face => face.cameraVertices);
  const depthMasks = [
    ...axes.flatMap(axis => [
      { id: `${maskPrefix}-${axis.id}-line`, polygons: cubeAxisOccluders(facets, axisOrigin, axis.end) },
      { id: `${maskPrefix}-${axis.id}-label`, polygons: cubeAxisOccluders(facets, axis.end) },
    ]),
    { id: `${maskPrefix}-origin`, polygons: cubeAxisOccluders(facets, axisOrigin) },
  ];

  return (
    <div id={id} className={classes.join(" ")} aria-label="Viewport navigation">
      <button className="aui-viewport-cube-roll aui-viewport-cube-roll--left" type="button" title="Roll view counterclockwise" aria-label="Roll view counterclockwise" onClick={() => onRoll(-1)}>
        <NavigationArrow name="roll-left" />
      </button>
      <button className="aui-viewport-cube-roll aui-viewport-cube-roll--right" type="button" title="Roll view clockwise" aria-label="Roll view clockwise" onClick={() => onRoll(1)}>
        <NavigationArrow name="roll-right" />
      </button>
      <button className="aui-viewport-cube-nudge aui-viewport-cube-nudge--up" type="button" title="Nudge view up 15 degrees" aria-label="Nudge view up 15 degrees" onClick={() => onNudge(0, 1)}><NavigationArrow name="up" /></button>
      <button className="aui-viewport-cube-nudge aui-viewport-cube-nudge--left" type="button" title="Nudge view left 15 degrees" aria-label="Nudge view left 15 degrees" onClick={() => onNudge(-1, 0)}><NavigationArrow name="left" /></button>
      <ViewportCubeScene orientation={orientation} upAxis={upAxis} highlight={highlight} onReady={setSceneReady} />
      <svg className="aui-viewport-cube-stage" viewBox="0 0 92 92" role="img" aria-label="Camera ViewCube">
        <defs>
          {depthMasks.map(mask => <mask key={mask.id} id={mask.id} maskUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300" style={{ maskType: "luminance" }}>
            <rect x="-100" y="-100" width="300" height="300" fill="white" />
            {mask.polygons.map((polygon, index) => <polygon key={index} fill="black" points={polygon.map(vertex => project(vertex).join(",")).join(" ")} />)}
          </mask>)}
        </defs>
        {projections.map((face) => {
          const [labelX, labelY] = centroid(face.points);
          const right = rotateIntoCamera(face.right ?? [1,0,0], orientation);
          const up = rotateIntoCamera(face.up ?? [0,1,0], orientation);
          const labelTransform=`matrix(${right[0]} ${-right[1] || 0} ${-up[0] || 0} ${up[1]} ${labelX} ${labelY})`;
          const activate = () => face.view ? onSelectView(face.view) : onSelectDirection?.(face.normal);
          const interactive = !!face.view || !!onSelectDirection;
          return (
            <g
              key={face.id}
              className={`aui-viewport-cube-face aui-viewport-cube-face--${face.kind}`}
              data-view={face.view}
              data-cube-region={face.id}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={`${face.label} view`}
              onPointerEnter={() => setHighlight(face.id)}
              onPointerLeave={() => setHighlight(null)}
              onFocus={() => setHighlight(face.id)}
              onBlur={() => setHighlight(null)}
              onClick={activate}
              onKeyDown={(event) => { if(event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); activate(); } }}
            >
              <polygon style={{ fill: `var(${viewportCubeColorTokens[face.kind]})` }} points={face.points.map(([x, y]) => `${x},${y}`).join(" ")} />
              {face.view ? <text x={0} y={0} transform={labelTransform}>{face.label.toUpperCase()}</text> : null}
            </g>
          );
        })}
        <g className="aui-viewport-cube-axes" aria-hidden="true" pointerEvents="none">
          {axes.map((axis) => {
            const [endX, endY] = project(axis.end);
            return (
              <g key={axis.id} className={`aui-viewport-cube-axis-${axis.id}`}>
                <line mask={`url(#${maskPrefix}-${axis.id}-line)`} x1={axisX} y1={axisY} x2={endX} y2={endY} />
                <text mask={`url(#${maskPrefix}-${axis.id}-label)`} x={endX} y={endY}>{axis.id.toUpperCase()}</text>
              </g>
            );
          })}
          <circle mask={`url(#${maskPrefix}-origin)`} cx={axisX} cy={axisY} r="1.8" />
        </g>
      </svg>
      <button className="aui-viewport-cube-nudge aui-viewport-cube-nudge--right" type="button" title="Nudge view right 15 degrees" aria-label="Nudge view right 15 degrees" onClick={() => onNudge(1, 0)}><NavigationArrow name="right" /></button>
      <button className="aui-viewport-cube-nudge aui-viewport-cube-nudge--down" type="button" title="Nudge view down 15 degrees" aria-label="Nudge view down 15 degrees" onClick={() => onNudge(0, -1)}><NavigationArrow name="down" /></button>
      <ViewportCubeHome onHome={onFit} items={homeMenuItems} onSelect={onHomeMenuSelect} />
    </div>
  );
}

const arrows = {"roll-left":arrow0,"roll-right":arrow1,"up":arrow2,"left":arrow3,"right":arrow4,"down":arrow5};
function NavigationArrow({name}: {name: keyof typeof arrows}) {
  const source=arrows[name];
  return <svg aria-hidden="true" viewBox={name.startsWith("roll") ? "0 0 44 28" : "0 0 24 24"} dangerouslySetInnerHTML={{__html:source.replace(/<svg[^>]*>|<\/svg>/g,"")}} />;
}
