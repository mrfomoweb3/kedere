import { useEffect, useRef, useState } from "react";

const GLYPHS = "abcdefghijklmnopqrstuvwxyzóíàèẹọɗ0123456789#%&";
const prefersReduced =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Smoothly "decodes" from the previous text to a new target: unrevealed
 * characters flicker through random glyphs, then settle left-to-right.
 * Spaces and punctuation are preserved so the word shape stays legible.
 */
export function ScrambleText({
  text,
  className,
  duration = 900,
}: {
  text: string;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(text);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(text);
      return;
    }
    const target = text;
    const len = target.length;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - startRef.current) / duration);
      const revealed = Math.floor(p * len);
      let out = "";
      for (let i = 0; i < len; i++) {
        const ch = target[i];
        if (i < revealed || ch === " " || ch === "," || ch === ".") {
          out += ch;
        } else {
          out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
      }
      setDisplay(out);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, duration]);

  return (
    <span className={className} aria-label={text}>
      {display}
    </span>
  );
}
