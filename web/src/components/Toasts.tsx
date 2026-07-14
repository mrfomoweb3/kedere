import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { explorerTx } from "../contract/config";

type ToastKind = "pending" | "success" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  txHash?: string;
}

interface ToastApi {
  push: (t: Omit<Toast, "id">) => number;
  update: (id: number, patch: Partial<Toast>) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToasts() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToasts outside provider");
  return c;
}

let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = seq++;
      setToasts((prev) => [...prev, { ...t, id }]);
      if (t.kind !== "pending")
        setTimeout(() => dismiss(id), 6000);
      return id;
    },
    [dismiss],
  );

  const update = useCallback(
    (id: number, patch: Partial<Toast>) => {
      setToasts((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      );
      if (patch.kind && patch.kind !== "pending")
        setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ push, update, dismiss }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className={`toast-dot dot-${t.kind}`} />
            <div className="toast-body">
              <span>{t.text}</span>
              {t.txHash && (
                <a
                  href={explorerTx(t.txHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on explorer ↗
                </a>
              )}
            </div>
            <button className="toast-x" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
