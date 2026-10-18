import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { SelectField } from "./SelectField";
import "./NewDesignDialog.css";

/**
 * "What do you want to design?" — the chooser an app shows when creating a
 * document could mean several different things.
 *
 * Jonathan supplied Fusion's dialog as the reference (2026-10-04) and asked
 * for it as an Aether UI standard, so nothing here is CAD-specific: an app
 * passes the kinds it offers, and each kind carries its own description and
 * optional settings. Aether Map would offer a show and a surface template the
 * same way.
 *
 * Kinds an app cannot create yet are passed with `unavailable` rather than
 * omitted. Showing the whole menu with its gaps named is how someone learns
 * what the application is for; a short menu just looks like the whole product.
 */

export interface DesignKind {
  id: string;
  title: string;
  /** One line under the title, and the heading of the detail panel. */
  summary: string;
  /** The paragraph in the detail panel. */
  description?: string;
  icon?: ReactNode;
  /** Why it cannot be chosen. Shown in the panel; the card stays visible. */
  unavailable?: string;
  /** Extra controls for this kind alone — a template picker, a template list. */
  settings?: ReactNode;
}

export interface NewDesignDialogProps {
  title?: string;
  kinds: readonly DesignKind[];
  /** Pre-selected kind; defaults to the first that is available. */
  defaultKindID?: string;
  /** Shown for every kind, as Fusion shows its unit system. */
  units?: { label: string; value: string; options: readonly { value: string; label: string }[];
    onChange: (value: string) => void };
  /** A documentation link, bottom left. */
  learnMoreHref?: string;
  createLabel?: string;
  busy?: boolean;
  onCreate: (kindID: string) => void;
  onClose: () => void;
}

export function NewDesignDialog({
  title = "What do you want to design?", kinds, defaultKindID, units,
  learnMoreHref, createLabel = "Create New", busy = false, onCreate, onClose,
}: NewDesignDialogProps) {
  const firstAvailable = kinds.find((kind) => !kind.unavailable)?.id ?? kinds[0]?.id ?? "";
  const [chosen, setChosen] = useState(defaultKindID ?? firstAvailable);
  const kind = kinds.find((entry) => entry.id === chosen) ?? kinds[0];

  return (
    <Dialog
      open
      title={title}
      onClose={onClose}
      actions={<>
        {learnMoreHref ? (
          <a className="aui-new-design-learn" href={learnMoreHref} target="_blank" rel="noreferrer">Learn More</a>
        ) : null}
        <Button disabled={busy} onClick={onClose}>Cancel</Button>
        <Button primary disabled={busy || !kind || Boolean(kind.unavailable)} onClick={() => kind && onCreate(kind.id)}>
          {busy ? "Creating…" : createLabel}
        </Button>
      </>}
    >
      <div className="aui-new-design">
        {/* Radios, not buttons: this is one choice among several, and the
            arrow keys should move between them the way a radio group does. */}
        <div className="aui-new-design-kinds" role="radiogroup" aria-label={title}>
          {kinds.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={entry.id === chosen}
              className="aui-new-design-kind"
              data-chosen={entry.id === chosen || undefined}
              data-unavailable={entry.unavailable ? "" : undefined}
              onClick={() => setChosen(entry.id)}
              onDoubleClick={() => { if (!entry.unavailable && !busy) onCreate(entry.id); }}
            >
              <span className="aui-new-design-art" aria-hidden="true">{entry.icon}</span>
              <span className="aui-new-design-name">{entry.title}</span>
            </button>
          ))}
        </div>

        {kind ? (
          <div className="aui-new-design-detail">
            <h3>{kind.title}</h3>
            <p>{kind.description ?? kind.summary}</p>
            {kind.unavailable ? (
              <p className="aui-new-design-unavailable" role="note">{kind.unavailable}</p>
            ) : (
              <>
                {units ? (
                  <label className="aui-new-design-setting">
                    {units.label}
                    <SelectField
                      aria-label={units.label}
                      value={units.value}
                      options={units.options}
                      onChange={(event) => units.onChange(event.target.value)}
                    />
                  </label>
                ) : null}
                {kind.settings}
              </>
            )}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
