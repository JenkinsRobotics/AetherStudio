import { useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";

/**
 * Dope-sheet timeline: labeled tracks, keyframe diamonds, adaptive time
 * ruler, draggable playhead. Purely presentational — the app owns time,
 * playback, and keyframe mutation through its engine.
 * Behavior reference: Swift `TimelineEditorView` + `UIDevTimelineDesignB`.
 */
export interface TimelineKeyframe {
  timeS: number;
  value?: number;
}

export interface TimelineTrack {
  id: string;
  label: string;
  detail?: string;
  color?: string;
  kind?: "motion" | "audio" | "event";
  keyframes: readonly TimelineKeyframe[];
}

export type TimelineEditorMode = "dope-sheet" | "curves";

export interface TimelineProps {
  tracks: readonly TimelineTrack[];
  durationS: number;
  timeS: number;
  onSeek: (timeS: number) => void;
  playing?: boolean;
  onTogglePlay?: () => void;
  selected?: { trackID: string; index: number } | null;
  onSelectKeyframe?: (trackID: string, index: number) => void;
  emptyState?: ReactNode;
  variant?: "compact" | "editor";
  clipName?: string;
  framesPerSecond?: number;
  onFramesPerSecondChange?: (framesPerSecond: number) => void;
  looping?: boolean;
  onToggleLoop?: () => void;
  onStop?: () => void;
  onStepFrame?: (direction: -1 | 1) => void;
  onSeekAdjacentKeyframe?: (direction: -1 | 1) => void;
  mode?: TimelineEditorMode;
  outputStatus?: string;
}

const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];

function tickStep(durationS: number): number {
  const target = durationS / 8;
  return TICK_STEPS.find((step) => step >= target) ?? 60;
}

function timecode(timeS: number, framesPerSecond: number): string {
  const clamped = Math.max(timeS, 0);
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.floor(clamped % 60);
  const frames = Math.floor((clamped - Math.floor(clamped)) * framesPerSecond + 1e-6);
  return [minutes, seconds, frames]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

function TransportGlyph({ kind }: { kind: "previous-key" | "previous-frame" | "stop" | "play" | "pause" | "next-frame" | "next-key" }) {
  if (kind === "play") return <AetherIcon name="play" />;
  if (kind === "stop") return <span className="aui-timeline-stop-glyph" />;
  if (kind === "pause") return <span className="aui-timeline-pause-glyph"><i /><i /></span>;
  const previous = kind.startsWith("previous");
  const doubled = kind.endsWith("key");
  return <span className={`aui-timeline-chevron-glyph${previous ? " aui-timeline-chevron-glyph--previous" : ""}`}>
    <AetherIcon name="chevron" />
    {doubled ? <AetherIcon name="chevron" /> : null}
  </span>;
}

function trackIcon(track: TimelineTrack) {
  if (track.kind === "audio") return <AetherIcon name="animate" />;
  if (track.kind === "event") return <AetherIcon name="hardware" />;
  return <AetherIcon name="revolute" />;
}

function graphPoints(track: TimelineTrack, duration: number, trackIndex: number): string {
  if (track.keyframes.length === 0) return "";
  const values = track.keyframes.map((keyframe, index) => keyframe.value ?? Math.sin(index + trackIndex) * 0.7);
  const minimum = Math.min(...values, -1);
  const maximum = Math.max(...values, 1);
  const range = Math.max(maximum - minimum, 1e-6);
  return track.keyframes.map((keyframe, index) => {
    const x = (keyframe.timeS / duration) * 100;
    const y = 12 + (1 - (values[index]! - minimum) / range) * 76;
    return `${x},${y}`;
  }).join(" ");
}

export function Timeline(props: TimelineProps) {
  const { tracks, durationS, timeS, onSeek } = props;
  const lanesRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  if (tracks.length === 0) {
    return <div className="aui-timeline"><div className="aui-timeline-empty">{props.emptyState ?? "no tracks"}</div></div>;
  }

  const duration = Math.max(durationS, 1e-6);
  const toPercent = (time: number) => `${(time / duration) * 100}%`;
  const seekFromEvent = (event: ReactPointerEvent) => {
    const lanes = lanesRef.current;
    if (!lanes) return;
    const rect = lanes.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = (event.clientX - rect.left) / rect.width;
    onSeek(Math.min(Math.max(fraction, 0), 1) * duration);
  };
  const onPointerDown = (event: ReactPointerEvent) => {
    scrubbing.current = true;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    seekFromEvent(event);
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (scrubbing.current) seekFromEvent(event);
  };
  const onPointerUp = () => { scrubbing.current = false; };

  const step = tickStep(duration);
  const ticks: number[] = [];
  for (let time = 0; time <= duration + 1e-9; time += step) ticks.push(time);

  if (props.variant === "editor") {
    const framesPerSecond = props.framesPerSecond ?? 30;
    const mode = props.mode ?? "dope-sheet";
    return <div className="aui-timeline aui-timeline--editor" data-mode={mode}>
      <div className="aui-timeline-editor-transport">
        <div className="aui-timeline-editor-buttons">
          <button type="button" aria-label="Previous keyframe" disabled={!props.onSeekAdjacentKeyframe} onClick={() => props.onSeekAdjacentKeyframe?.(-1)}><TransportGlyph kind="previous-key" /></button>
          <button type="button" aria-label="Previous frame" disabled={!props.onStepFrame} onClick={() => props.onStepFrame?.(-1)}><TransportGlyph kind="previous-frame" /></button>
          <button type="button" aria-label="Stop" disabled={!props.onStop} onClick={props.onStop}><TransportGlyph kind="stop" /></button>
          <button type="button" aria-label={props.playing ? "Pause" : "Play"} disabled={!props.onTogglePlay} onClick={props.onTogglePlay}><TransportGlyph kind={props.playing ? "pause" : "play"} /></button>
          <button type="button" aria-label="Next frame" disabled={!props.onStepFrame} onClick={() => props.onStepFrame?.(1)}><TransportGlyph kind="next-frame" /></button>
          <button type="button" aria-label="Next keyframe" disabled={!props.onSeekAdjacentKeyframe} onClick={() => props.onSeekAdjacentKeyframe?.(1)}><TransportGlyph kind="next-key" /></button>
          <span className="aui-timeline-editor-divider" />
          <button type="button" className={props.looping ? "aui-timeline-loop--active" : undefined} aria-label="Loop preview" aria-pressed={props.looping} disabled={!props.onToggleLoop} onClick={props.onToggleLoop}><AetherIcon name="redo" /></button>
          <strong>{props.clipName ?? "Animation"}</strong>
        </div>
        <div className="aui-timeline-editor-status">
          <label><span className="aui-visually-hidden">Frame rate</span><select aria-label="Frame rate" value={framesPerSecond} disabled={!props.onFramesPerSecondChange} onChange={(event) => props.onFramesPerSecondChange?.(Number(event.target.value))}>
            {[24, 25, 30, 60].map((value) => <option key={value} value={value}>{value} fps</option>)}
          </select></label>
          <output aria-label="Timeline position">{timecode(timeS, framesPerSecond)} <span>/ {timecode(duration, framesPerSecond)}</span></output>
          <span className="aui-timeline-output-state"><AetherIcon name="hardware" />{props.outputStatus ?? "OUTPUT OFFLINE"}</span>
        </div>
      </div>
      <div className="aui-timeline-editor-body">
        <div className="aui-timeline-editor-side">
          <div className="aui-timeline-editor-side-heading"><strong>{mode === "curves" ? "VISIBLE CURVES" : "TRACKS"}</strong><span>{tracks.filter((track) => track.kind !== "audio" && track.kind !== "event").length} motion</span></div>
          {tracks.map((track) => <div key={track.id} className="aui-timeline-editor-track-label" style={{ "--aui-timeline-track-color": track.color } as CSSProperties}>
            <span className="aui-timeline-editor-track-icon">{trackIcon(track)}</span>
            <span><strong>{track.label}</strong><small>{track.detail ?? (track.kind === "motion" ? "rad" : "")}</small></span>
          </div>)}
        </div>
        <div className="aui-timeline-lanes aui-timeline-editor-lanes" ref={lanesRef}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <div className="aui-timeline-ruler">
            {ticks.map((tick) => <span key={tick.toFixed(3)} className="aui-timeline-tick" style={{ left: toPercent(tick) }}>{step >= 1 ? `${tick.toFixed(0)}s` : tick.toFixed(2)}</span>)}
          </div>
          <div className="aui-timeline-play-range"><span /><span /></div>
          {mode === "dope-sheet" ? tracks.map((track) => <div key={track.id} className="aui-timeline-row aui-timeline-editor-row" style={{ "--aui-timeline-track-color": track.color } as CSSProperties}>
            {track.keyframes.length === 0 ? <span className="aui-timeline-empty-lane">{track.kind === "audio" ? "Import audio to display a waveform" : "No authored events"}</span> : null}
            {track.keyframes.map((keyframe, index) => {
              const isSelected = props.selected?.trackID === track.id && props.selected.index === index;
              return <span key={index} role="button" aria-label={`${track.label} keyframe at ${keyframe.timeS.toFixed(2)}s`}
                className={isSelected ? "aui-timeline-key aui-timeline-key--selected" : "aui-timeline-key"}
                style={{ left: toPercent(keyframe.timeS) }} onPointerDown={(event) => { event.stopPropagation(); props.onSelectKeyframe?.(track.id, index); }} />;
            })}
          </div>) : <svg className="aui-timeline-graph" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Animation curves">
            {tracks.filter((track) => track.keyframes.length > 0).map((track, index) => <polyline key={track.id} points={graphPoints(track, duration, index)} style={{ "--aui-timeline-track-color": track.color } as CSSProperties} />)}
          </svg>}
          <div className="aui-timeline-playhead" style={{ left: toPercent(timeS) }} />
        </div>
      </div>
    </div>;
  }

  return <div className="aui-timeline">
    <div className="aui-timeline-side">
      <div className="aui-timeline-transport">
        {props.onTogglePlay ? <button type="button" className="aui-icon-button" aria-label={props.playing ? "Pause" : "Play"} onClick={props.onTogglePlay}>
          {props.playing ? <TransportGlyph kind="pause" /> : <AetherIcon name="play" />}
        </button> : null}
        <span className="aui-timeline-clock">{timeS.toFixed(2)}s</span>
      </div>
      {tracks.map((track) => <div key={track.id} className="aui-timeline-label" title={track.label}>{track.label}</div>)}
    </div>
    <div className="aui-timeline-lanes" ref={lanesRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <div className="aui-timeline-ruler">
        {ticks.map((tick) => <span key={tick.toFixed(3)} className="aui-timeline-tick" style={{ left: toPercent(tick) }}>{step >= 1 ? tick.toFixed(0) : tick.toFixed(2)}</span>)}
      </div>
      {tracks.map((track) => <div key={track.id} className="aui-timeline-row">
        {track.keyframes.map((keyframe, index) => {
          const isSelected = props.selected?.trackID === track.id && props.selected.index === index;
          return <span key={index} role="button" aria-label={`${track.label} keyframe at ${keyframe.timeS.toFixed(2)}s`}
            className={isSelected ? "aui-timeline-key aui-timeline-key--selected" : "aui-timeline-key"}
            style={{ left: toPercent(keyframe.timeS) }} onPointerDown={(event) => { event.stopPropagation(); props.onSelectKeyframe?.(track.id, index); }} />;
        })}
      </div>)}
      <div className="aui-timeline-playhead" style={{ left: toPercent(timeS) }} />
    </div>
  </div>;
}
