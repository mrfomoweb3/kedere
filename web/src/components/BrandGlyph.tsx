// Estate glyph — two rooftops, reads as "a community of homes". Inherits
// currentColor so it works on both the green and lime brand marks.
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 12 8 7.5 13.5 12" />
      <path d="M4 11v8h8v-8" />
      <path d="M12 12.5 16.25 9 20.5 12.5" />
      <path d="M13.5 19h6v-6.5" />
      <path d="M7 19v-3h2v3" />
    </svg>
  );
}
