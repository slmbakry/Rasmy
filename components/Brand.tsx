// The platform's name as a mark, for wherever it appears inside running text:
// the page glyph from the logo beside the name, in the brand colour, never split.
export function Brand() {
  return (
    <span className="brand-word">
      <svg viewBox="0 0 240 240" aria-hidden="true" focusable="false">
        <circle cx="120" cy="120" r="100.8" fill="none" stroke="currentColor" strokeWidth="24" />
        <path d="M104.64,64.8 H160.8 Q168,64.8 168,72 V168 Q168,175.2 160.8,175.2 H79.2 Q72,175.2 72,168 V97.44 Z" fill="currentColor" />
      </svg>
      ورقك
    </span>
  );
}
