/**
 * Reveals text one character at a time, left to right — each glyph fades and
 * de-blurs into place. The final text is laid out immediately (only opacity /
 * blur / transform animate, none of which affect layout), so there is zero
 * reflow while it plays. Re-keying on `text` replays the reveal on each change.
 */
export function ScrambleText({
  text,
  className,
  stagger = 0.03,
}: {
  text: string;
  className?: string;
  stagger?: number;
}) {
  const words = text.split(" ");
  let idx = 0;

  return (
    <span className={className} aria-label={text} key={text}>
      {words.map((word, wi) => (
        <span className="scramble-word" key={wi}>
          {Array.from(word).map((ch, ci) => {
            const delay = idx++ * stagger;
            return (
              <span
                className="scramble-char"
                style={{ animationDelay: `${delay}s` }}
                key={ci}
              >
                {ch}
              </span>
            );
          })}
          {wi < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
