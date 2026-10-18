import { CAD_FEATURE_EDITORS, FeatureEditor } from "./CADFeatureEditors";
import { CompactFeaturePopupDemo } from "./CompactFeaturePopupDemo";

/** Each design has its own section of bare, side-by-side specimens. */
export function FeatureEditorVariants() {
  return <div className="feature-editor-variants">
    <section className="feature-editor-design" aria-label="Standard feature editors">
      <h2>Standard</h2>
      <div className="feature-editor-row">
        {CAD_FEATURE_EDITORS.map(editor => <div className="feature-editor-specimen" key={editor.id}>
          <small>{editor.id === "mate" ? "Mate" : editor.title.replace(/\s+\d+$/, "")}</small>
          <FeatureEditor editor={editor} />
        </div>)}
      </div>
    </section>
    <section className="feature-editor-design" aria-label="Compact feature editors">
      <h2>Compact</h2>
      <div className="feature-editor-row feature-editor-row--compact">
        {CAD_FEATURE_EDITORS.map(editor => <div className="feature-editor-specimen" key={editor.id} role="group" aria-label={`${editor.title.replace(/\s+\d+$/, "")} compact specimen`}>
          <small>{editor.id === "mate" ? "Mate" : editor.title.replace(/\s+\d+$/, "")}</small>
          <CompactFeaturePopupDemo editor={editor} />
        </div>)}
      </div>
    </section>
  </div>;
}
