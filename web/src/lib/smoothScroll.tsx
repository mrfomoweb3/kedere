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

    // One context owns every reveal trigger created this route (initial scan +
    // any that mount later) so a single revert() cleans them all up.
    const ctx = gsap.context(() => {});
    const seen = new WeakSet<HTMLElement>();

    // Register one element; returns true if it was newly handled.
    const reveal = (el: HTMLElement) => {
      if (seen.has(el)) return false;
      seen.add(el);
      ctx.add(() => {
        gsap.set(el, { opacity: 0, y: 22 }); // matches CSS pre-state (no flash)
        ScrollTrigger.create({
          trigger: el,
          start: "top 88%",
          once: true,
          onEnter: () =>
            gsap.to(el, {
              opacity: 1,
              y: 0,
              duration: 0.7,
              ease: "power2.out",
              overwrite: true,
              clearProps: "transform", // no lingering layers once shown
            }),
        });
      });
      return true;
    };

    const scan = (root: ParentNode) => {
      let found = false;
      root
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((el) => (reveal(el) ? (found = true) : null));
      if (found) ScrollTrigger.refresh();
    };

    // Initial pass once the new route has painted.
    const raf = requestAnimationFrame(() => scan(document.body));

    // Content that mounts asynchronously (e.g. Welcome's role cards after its
    // backend lookup) would otherwise stay stuck at the hidden pre-state —
    // catch those additions and reveal them too. Only refresh when we actually
    // handle something, so busy pages (the live dashboard) aren't churned.
    const mo = new MutationObserver((muts) => {
      let found = false;
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches("[data-reveal]") && reveal(n)) found = true;
          n.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) =>
            reveal(el) ? (found = true) : null,
          );
        });
      }
      if (found) ScrollTrigger.refresh();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ctx.revert();
    };
  }, [path]);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
