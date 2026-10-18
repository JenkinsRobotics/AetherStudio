import {
  AetherIcon,
  SegmentedControl,
  Timeline,
  type TimelineTrack,
} from "../src/index";

export type AnimateCenterView = "three-d" | "dope-sheet" | "curves";

export const studioTimelineTracks: readonly TimelineTrack[] = [
  {
    id: "head-pan",
    label: "Head · pan",
    detail: "rad",
    kind: "motion",
    color: "#54a9fb",
    keyframes: [
      { timeS: 0, value: 0 },
      { timeS: 1.2, value: 0.42 },
      { timeS: 2.6, value: -0.28 },
      { timeS: 4.4, value: 0.08 },
    ],
  },
  {
    id: "head-tilt",
    label: "Head · tilt",
    detail: "rad",
    kind: "motion",
    color: "#b778ed",
    keyframes: [
      { timeS: 0, value: 0.05 },
      { timeS: 1.8, value: -0.18 },
      { timeS: 3.3, value: 0.34 },
      { timeS: 5, value: 0 },
    ],
  },
  {
    id: "jaw-open",
    label: "Jaw · open",
    detail: "rad",
    kind: "motion",
    color: "#42c89f",
    keyframes: [
      { timeS: 0.45, value: 0 },
      { timeS: 1.05, value: 0.7 },
      { timeS: 1.55, value: 0.1 },
      { timeS: 3.7, value: 0.58 },
      { timeS: 4.25, value: 0 },
    ],
  },
  { id: "audio", label: "Audio", detail: "No media", kind: "audio", color: "#49c97b", keyframes: [] },
  { id: "events", label: "Events", detail: "Planned", kind: "event", color: "#ff923d", keyframes: [] },
];

export const studioTimelineDurationS = 5;

export function adjacentKeyframe(timeS: number, direction: -1 | 1): number {
  const times = [...new Set(studioTimelineTracks.flatMap((track) => track.keyframes.map((keyframe) => keyframe.timeS)))].sort((a, b) => a - b);
  if (direction < 0) return [...times].reverse().find((time) => time < timeS - 1e-4) ?? 0;
  return times.find((time) => time > timeS + 1e-4) ?? studioTimelineDurationS;
}

function AnimateViewport({ timeS }: { timeS: number }) {
  return <div className="animation-viewport animation-animation-preview">
    <div className="animation-viewport-grid" aria-hidden />
    <div className="animation-rig-figure" style={{ transform: `rotate(${Math.sin(timeS * 2) * 4}deg)` }}>
      <span className="animation-rig-head" /><span className="animation-rig-body" />
      <span className="animation-rig-arm animation-rig-arm--left" /><span className="animation-rig-arm animation-rig-arm--right" />
    </div>
    <div className="animation-viewport-caption"><strong>ANIMATION PREVIEW</strong><span>Main · {timeS.toFixed(2)}s</span></div>
  </div>;
}

export function StudioAnimateWorkspace({ mode, timeS, playing, looping, framesPerSecond, selectedKey,
  onModeChange, onSeek, onTogglePlay, onStopPlayback, onToggleLoop, onFramesPerSecondChange, onSelectKeyframe }: {
  mode: AnimateCenterView;
  timeS: number;
  playing: boolean;
  looping: boolean;
  framesPerSecond: number;
  selectedKey: { trackID: string; index: number } | null;
  onModeChange: (mode: AnimateCenterView) => void;
  onSeek: (timeS: number) => void;
  onTogglePlay: () => void;
  onStopPlayback: () => void;
  onToggleLoop: () => void;
  onFramesPerSecondChange: (framesPerSecond: number) => void;
  onSelectKeyframe: (selection: { trackID: string; index: number }) => void;
}) {
  return <div className="animation-animate-workspace">
    <div className="animation-animate-center">
      {mode === "three-d" ? <AnimateViewport timeS={timeS} /> : <Timeline
        variant="editor"
        mode={mode}
        tracks={studioTimelineTracks}
        durationS={studioTimelineDurationS}
        timeS={timeS}
        onSeek={onSeek}
        playing={playing}
        onTogglePlay={onTogglePlay}
        looping={looping}
        onToggleLoop={onToggleLoop}
        onStop={onStopPlayback}
        onStepFrame={(direction) => onSeek(Math.min(Math.max(timeS + direction / framesPerSecond, 0), studioTimelineDurationS))}
        onSeekAdjacentKeyframe={(direction) => onSeek(adjacentKeyframe(timeS, direction))}
        framesPerSecond={framesPerSecond}
        onFramesPerSecondChange={onFramesPerSecondChange}
        clipName="Main"
        outputStatus="OUTPUT OFFLINE"
        selected={selectedKey}
        onSelectKeyframe={(trackID, index) => {
          onSelectKeyframe({ trackID, index });
          const track = studioTimelineTracks.find((candidate) => candidate.id === trackID);
          const keyframe = track?.keyframes[index];
          if (keyframe) onSeek(keyframe.timeS);
        }}
      />}
    </div>
    <div className="animation-animate-switcher">
      <SegmentedControl ariaLabel="Animate center view" value={mode} onChange={(id) => onModeChange(id as AnimateCenterView)} options={[
        { id: "three-d", label: "3D", icon: <AetherIcon name="cube" /> },
        { id: "dope-sheet", label: "Dope Sheet", icon: <AetherIcon name="animate" /> },
        { id: "curves", label: "Curves", icon: <AetherIcon name="sketch-nodes" /> },
      ]} />
    </div>
  </div>;
}
