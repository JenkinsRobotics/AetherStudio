import { useId } from "react";

/** Small illustrative CAD review attachments; these are diagrams, not icons or
 * measurements taken from the live scene. Geometry stays in the product. */
export function ReviewModelPreview({ clearance = false }: { clearance?: boolean }) {
  const id = useId().replace(/:/g, "");
  return <svg className="ps-review-model-image" viewBox="0 0 340 184" role="img" aria-label={clearance ? "Bracket clearance review illustration, 2.5 mm" : "Housing wall review illustration with selected blue rim"}>
    <defs><linearGradient id={`${id}-metal`} x2=".8" y2="1"><stop stopColor="#aab7c0"/><stop offset=".48" stopColor="#637582"/><stop offset="1" stopColor="#384752"/></linearGradient><linearGradient id={`${id}-bg`} x2="1" y2="1"><stop stopColor="#303c44"/><stop offset="1" stopColor="#141d24"/></linearGradient></defs>
    <rect width="340" height="184" fill={`url(#${id}-bg)`}/>
    <g stroke="#9baab433" strokeWidth=".7">{[0, 1, 2, 3, 4, 5, 6].map(i => <path key={i} d={`M${i * 65 - 100} 184l220-184 M0 ${i * 35}l340-80`}/>)}</g>
    {clearance ? <>
      <path d="M32 62L151 24 151 150 32 178Z" fill={`url(#${id}-metal)`} stroke="#a0acb4"/>
      <path d="M151 24L169 34 169 160 151 150Z" fill="#4e606d" stroke="#8496a1"/>
      <path d="M201 41L315 82 315 170 201 130Z" fill="#27343d" stroke="#6d7e8a"/>
      <path d="M201 41L218 31 332 72 315 82Z" fill="#61727e"/>
      <ellipse cx="91" cy="112" rx="21" ry="28" fill="#26343e" stroke="#9faeb8" strokeWidth="5"/><ellipse cx="91" cy="112" rx="12" ry="18" fill="#111b23"/>
      <g stroke="#ffba67" strokeWidth="2"><path d="M178 40v108M194 46v108M178 60h16M178 130h16"/><path d="M185 56l-7 4 7 4m2-8 7 4-7 4M185 126l-7 4 7 4m2-8 7 4-7 4"/></g>
      <rect x="206" y="92" width="83" height="30" rx="6" fill="#10191fe6"/><text x="247" y="112" fill="#f3f5f7" textAnchor="middle" fontSize="15" fontFamily="sans-serif">2.5 mm</text>
    </> : <>
      <path d="M53 67L188 21 288 73 153 126Z" fill="#9caab4" stroke="#c3cbd1"/>
      <path d="M53 67L153 126 153 173 53 113Z" fill={`url(#${id}-metal)`} stroke="#9aaab6"/>
      <path d="M153 126L288 73 288 119 153 173Z" fill="#5b6f7f" stroke="#91a3b0"/>
      <path d="M85 69L188 34 258 74 155 114Z" fill="#17242d" stroke="#438bff" strokeWidth="3"/>
      <path d="M85 69L155 108 155 114M258 74L188 34 188 72 226 92" fill="#263a49" stroke="#4f6575"/>
      <path d="M85 69L188 34 258 74 155 114Z" fill="none" stroke="#438bff" strokeWidth="3"/>
      <path d="M255 44v25" stroke="#438bff" strokeWidth="2"/><circle cx="255" cy="36" r="15" fill="#337eff"/><text x="255" y="41" textAnchor="middle" fill="white" fontSize="16" fontFamily="sans-serif">1</text>
    </>}
  </svg>;
}
