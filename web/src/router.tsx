import { useSyncExternalStore, useCallback } from "react";

// Tiny history-based router — two routes, no dependency.
function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener("kedere:navigate", cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener("kedere:navigate", cb);
  };
}

export function navigate(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("kedere:navigate"));
}

export function usePath(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => "/",
  );
}

export function useNavigate() {
  return useCallback((to: string) => navigate(to), []);
}
