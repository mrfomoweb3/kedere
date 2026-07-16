// Estate mark — a bold, filled house silhouette with a doorway. Reads cleanly
// at small (logo) sizes and fills the brand box with good visual weight.
// Inherits currentColor so it works on both the green and lime marks.
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path
        d="M11.24 3.3a1.2 1.2 0 0 1 1.52 0l8.2 6.73c.86.7.36 2.09-.75 2.09H20v7.03c0 .63-.51 1.15-1.15 1.15H14.9v-4.9a2.9 2.9 0 0 0-5.8 0v4.9H5.15C4.51 20.3 4 19.78 4 19.15v-7.03h-.21c-1.11 0-1.61-1.38-.75-2.09l8.2-6.73Z"
      />
    </svg>
  );
}
