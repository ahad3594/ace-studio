"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowUp,
  Loader2,
  ArrowUpRight,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { defaultDocumentOptions } from "@/lib/documents/schema";
import type { DocumentOptions } from "@/lib/documents/schema";
import { toolBySlug } from "@/lib/documents/catalog";
export interface ToolPlan {
  tool: string | null;
  options: DocumentOptions;
  questions: string[];
  message: string;
  mode: "gemini" | "local";
  fallback?: boolean;
}
export function CommandBox({
  currentTool = null,
  options = defaultDocumentOptions,
  fileTypes = [],
  fileInfo = [],
  onPlan,
  compact = false,
}: {
  currentTool?: string | null;
  options?: DocumentOptions;
  fileTypes?: string[];
  fileInfo?: {kind:string;pages:number;width?:number;height?:number}[];
  onPlan?: (plan: ToolPlan) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [messages, setMessages] = useState<
      { role: "user" | "assistant"; text: string }[]
    >([]),
    [plan, setPlan] = useState<ToolPlan | null>(null),
    [error, setError] = useState("");
  async function analyze() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError("");
    const next = [...messages, { role: "user" as const, text: prompt }].slice(
      -8,
    );
    setMessages(next);
    setPrompt("");
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: next.at(-1)!.text,
          currentTool: plan?.tool ?? currentTool,
          currentOptions: onPlan && (!plan || plan.tool === currentTool) ? options : plan?.options ?? options,
          messages: next,
          fileTypes,
          fileInfo,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "The assistant could not analyze this request.",
        );
      setPlan(data);
      setMessages(
        [...next, { role: "assistant" as const, text: data.message }].slice(-8),
      );
      onPlan?.(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The local app server is not reachable. You can choose a tool directly.",
      );
    } finally {
      setBusy(false);
    }
  }
  function go() {
    if (!plan?.tool) return;
    if (plan.tool === "image-studio") {
      router.push("/studio");
      return;
    }
    const safe = { ...plan.options, password: "", newPassword: "", values: {} };
    sessionStorage.setItem(
      "ace-pending-plan",
      JSON.stringify({ tool: plan.tool, options: safe }),
    );
    router.push("/tools/" + plan.tool);
  }
  return (
    <section
      className={`ace-command ${compact ? "compact" : ""}`}
      aria-label="ACE intelligent command box"
    >
      <div className="command-heading">
        <span>
          <Sparkles size={15} />
          ACE ASSISTANT
        </span>
        <span className="command-mode">
          {plan?.mode === "gemini"
            ? "Gemini · conversational"
            : plan
              ? "Local interpretation"
              : "Your words → the right tool"}
        </span>
      </div>
      <div className="command-input">
        <textarea
          dir="auto"
          aria-label="Describe your document task"
          placeholder={
            compact
              ? "Tell ACE what you want to change…"
              : "“Turn these photos into a PDF, then help me make the file smaller…”"
          }
          maxLength={3000}
          value={prompt}
          disabled={busy}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void analyze();
            }
          }}
        />
        <button
          aria-label="Understand my request"
          disabled={!prompt.trim() || busy}
          onClick={() => void analyze()}
        >
          {busy ? (
            <Loader2 size={20} className="spin" />
          ) : (
            <ArrowUp size={20} />
          )}
        </button>
      </div>
      {!compact && !plan && (
        <div className="command-examples">
          {[
            "Make my PDF editable in Word",
            "Meri PDF ka size kam kar do",
            "Put my photos into one PDF",
          ].map((t) => (
            <button key={t} onClick={() => setPrompt(t)}>
              {t}
              <ArrowUpRight size={11} />
            </button>
          ))}
        </div>
      )}
      {plan && (
        <div className="command-answer" aria-live="polite">
          <MessageCircle size={17} />
          <div>
            <p>{plan.message}</p>
            {plan.questions.map(
              (q) => q !== plan.message && <small key={q}>{q}</small>,
            )}
            {plan.tool && (!onPlan || plan.tool !== currentTool) && (
              <button className="text-button" onClick={go}>
                Open{" "}
                {plan.tool === "image-studio"
                  ? "image studio"
                  : toolBySlug(plan.tool)?.title}
                <ArrowUpRight size={13} />
              </button>
            )}
            {plan.mode === "local" && (
              <small>
                Local interpretation is limited. Connect Gemini in Settings for
                flexible language, context and follow-up reasoning.
              </small>
            )}
          </div>
        </div>
      )}
      {error && (
        <p className="ace-error" role="alert">
          {error}
        </p>
      )}
      <div className="command-privacy">
        <ShieldCheck size={11} />
        Only your instructions and file types are used here. Document contents
        and passwords stay out of these AI requests.
      </div>
    </section>
  );
}
