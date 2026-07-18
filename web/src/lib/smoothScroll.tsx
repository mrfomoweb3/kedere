"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePath } from "../router";

// Site-wide smooth scroll + scroll animation engine.
//
// One RAF loop for everything: Lenis is stepped by GSAP's ticker (instead of
// its own requestAnimationFrame), and ScrollTrigger is updated from Lenis'
// scroll event. That keeps smooth-scroll, ScrollTrigger pins and reveal
// animations perfectly in sync on a single frame — no competing loops.
//
// Anything with a `data-reveal` attribute fades/rises into view once, batched
// so a page full of them costs one shared set of callbacks. Fully disabled
// under `prefers-reduced-motion`, where native scrolling takes over and every
// element is shown immediately.

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const LenisContext = createContext<Lenis | null>(null);

export function useLenis() {
  return useContext(LenisContext);
}

/** Returns a scroll-to helper that works with or without Lenis (reduced motion). */
export function useScrollTo() {
  const lenis = useLenis();
  return useCallback(
    (target: string | number | HTMLElement, offset = -80) => {
      if (lenis) {
        lenis.scrollTo(target, { offset, duration: 1.1 });
        return;
      }
      // reduced-motion / no-Lenis fallback
      const el =
        typeof target === "string" ? document.querySelector(target) : null;
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
      else if (typeof target === "number") window.scrollTo(0, target);
    },
    [lenis],
  );
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const lenisRef = useRef<Lenis | null>(null); // sync handle for effects
  const path = usePath();

  // ── init Lenis + wire it to GSAP's ticker and ScrollTrigger (once) ──
  useEffect(() => {
    if (reduceMotion()) return;
    gsap.registerPlugin(ScrollTrigger);

    const instance = new Lenis({
      duration: 1.1,
      easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic — soft, quick settle
      smoothWheel: true,
    });

    instance.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    lenisRef.current = instance;
    setLenis(instance);
    return () => {
      gsap.ticker.remove(tick);
      instance.destroy();
      lenisRef.current = null;
      setLenis(null);
    };
  }, []);

  // ── on route change: jump to top, reveal-in the new page, refresh triggers ──
  useEffect(() => {
    if (reduceMotion()) return;

    if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);

    let ctx: gsap.Context | undefined;
    // Let the new route paint before measuring / animating.
    const raf = requestAnimationFrame(() => {
      ctx = gsap.context(() => {
        const els = gsap.utils.toArray<HTMLElement>("[data-reveal]");
        if (els.length) {
          gsap.set(els, { opacity: 0, y: 22 }); // matches CSS pre-state (no flash)
          ScrollTrigger.batch("[data-reveal]", {
            start: "top 88%",
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                opacity: 1,
                y: 0,
                duration: 0.7,
                ease: "power2.out",
                stagger: 0.08,
                overwrite: true,
                // drop the inline transform once shown — no lingering layers
                clearProps: "transform",
              }),
          });
        }
        ScrollTrigger.refresh();
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      ctx?.revert();
    };
  }, [path]);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
