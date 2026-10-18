import { AetherIcon } from "./AetherIcon";

export function AdvisorWelcome({ hasContext = false }: { hasContext?: boolean }) {
  return <div className="aui-advisor-welcome">
    <p>Ask questions and plan your next step in Aether.</p>
    <strong>Working with</strong>
    <ul>
      {hasContext && <li><AetherIcon name="document"/><span>Shared workspace context</span></li>}
      <li><AetherIcon name="comment"/><span>Your conversation</span></li>
      <li><AetherIcon name="advisor"/><span>An AI provider, when connected</span></li>
    </ul>
  </div>;
}

/** Presentation examples only; product behavior remains in the owning app. */
export function advisorQuestions(app: string): string[] {
  switch (app) {
    case "cad": return ["How should I plan this part?", "Explain features and bodies.", "Help me review this design before creating a version."];
    case "map": return ["Help me plan a projection for this scene.", "How should I organize my surfaces?", "Help me write a creative brief for this projection."];
    case "animation": return ["Help me plan this character’s motion.", "Explain joints and movement limits.", "What should I review before previewing an animation?"];
    case "sketch": return ["Help me plan this drawing.", "How should I organize my sketch?", "Help me review this drawing before creating a version."];
    default: return ["What can you help me with?", "Help me plan my next step.", "What should I review before sharing my work?"];
  }
}
