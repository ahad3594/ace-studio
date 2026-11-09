"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
const ToastContext = createContext<(text: string, error?: boolean) => void>(
  () => {},
);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<
    { id: string; text: string; error: boolean }[]
  >([]);
  const notify = useCallback((text: string, error = false) => {
    const id = crypto.randomUUID();
    setMessages((s) => [...s.slice(-3), { id, text, error }]);
    setTimeout(() => setMessages((s) => s.filter((x) => x.id !== id)), 6500);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" aria-live="polite">
        {messages.map((m) => (
          <div
            role={m.error ? "alert" : "status"}
            className={`toast ${m.error ? "error" : ""}`}
            key={m.id}
          >
            {m.error ? <AlertCircle2Fix /> : <CheckCircle2 size={18} />}
            <span>{m.text}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setMessages((s) => s.filter((x) => x.id !== m.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
function AlertCircle2Fix() {
  return <AlertCircle size={18} />;
}
export const useToast = () => useContext(ToastContext);
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Switch({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="switch-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}
