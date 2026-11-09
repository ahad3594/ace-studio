"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, useReducedMotion } from "motion/react";
import {
  UploadCloud,
  Plus,
  X,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  WandSparkles,
  Download,
  ShieldCheck,
  Zap,
  Layers3,
  SlidersHorizontal,
  Check,
  CheckCircle2,
  AlertTriangle,
  Undo2,
  Redo2,
  Clock3,
  BookmarkPlus,
  Trash2,
  Loader2,
  ChevronDown,
  LockKeyhole,
  ImageIcon,
} from "lucide-react";
import { useStudio } from "@/store/studio";
import { defaultPlan, planSummary } from "@/lib/plan";
import { parsePrompt } from "@/lib/ai/parser";
import { planSchema } from "@/lib/schema";
import {
  bytesLabel,
  browserMetadata,
  processInBrowser,
  outputName,
  saveBlob,
} from "@/lib/client";
import type { ImageItem, Result } from "@/lib/client";
import { createZip } from "@/lib/batch";
import { Preview } from "./preview";
import { PlanEditor } from "./plan-editor";
import { useToast } from "./ui";
const suggestions = [
  "Compress to 100KB",
  "Resize to 600x600",
  "Convert to JPG",
  "Convert to WebP",
  "Make square",
  "Passport dimensions",
];
interface Caps {
  ai: boolean;
  maxImages: number;
  maxBytes: number;
  inputPixels: number;
  heif: boolean;
}
const defaultCaps: Caps = {
  ai: false,
  maxImages: 20,
  maxBytes: 20 * 1024 * 1024,
  inputPixels: 40_000_000,
  heif: false,
};
export function Studio({
  home = false,
  batch = false,
}: {
  home?: boolean;
  batch?: boolean;
}) {
  const s = useStudio(),
    notify = useToast(),
    reduceMotion = useReducedMotion();
  const [caps, setCaps] = useState(defaultCaps),
    [prompt, setPrompt] = useState(""),
    [analyzing, setAnalyzing] = useState(false),
    [uploading, setUploading] = useState(false),
    [busy, setBusy] = useState(false),
    [completed, setCompleted] = useState(0),
    [settings, setSettings] = useState(false),
    [zipBusy, setZipBusy] = useState(false),
    [showFeatures, setShowFeatures] = useState(false),
    [showHistory, setShowHistory] = useState(false),
    [presetName, setPresetName] = useState("");
  const uploadingRef = useRef(false),
    busyRef = useRef(false),
    promptRef = useRef<HTMLTextAreaElement>(null),
    workspaceRef = useRef<HTMLDivElement>(null),
    runRef = useRef<() => void>(() => {}),
    downloadRef = useRef<() => void>(() => {}),
    queueLimit = useRef(20);
  useEffect(() => {
    void fetch("/api/capabilities")
      .then((r) => r.json())
      .then((c) => {
        if (typeof c.maxImages === "number") {
          setCaps(c);
          queueLimit.current = c.maxImages;
          s.setMode(c.ai ? "ai" : "offline");
        }
      })
      .catch(() => {});
  }, []); // server capability, never credentials
  useEffect(() => {
    const text = new URLSearchParams(window.location.search).get("prompt");
    if (text) setPrompt(text.slice(0, 2000));
  }, []);
  const addFiles = useCallback(
    async (files: File[]) => {
      if (uploadingRef.current || busyRef.current) {
        notify("Please wait for the current operation.", true);
        return;
      }
      uploadingRef.current = true;
      setUploading(true);
      try {
        const remaining = caps.maxImages - useStudio.getState().items.length;
        if (files.length > remaining)
          notify(
            `Up to ${caps.maxImages} images per batch. Only available slots will be added.`,
            true,
          );
        const valid: ImageItem[] = [];
        for (const file of files.slice(0, Math.max(0, remaining))) {
          try {
            if (file.size > caps.maxBytes)
              throw new Error(
                `${file.name} exceeds ${bytesLabel(caps.maxBytes)}.`,
              );
            let meta, preview: string | undefined;
            if (navigator.onLine) {
              const form = new FormData();
              form.append("image", file);
              let response: Response;
              try {
                response = await fetch("/api/metadata", {
                  method: "POST",
                  body: form,
                });
              } catch {
                response = new Response(null, { status: 503 });
              }
              if (response.status === 503)
                meta = await browserMetadata(file, caps.inputPixels);
              else {
                const data = await response.json();
                if (!response.ok)
                  throw new Error(
                    data.error || "Image could not be validated.",
                  );
                preview = data.preview;
                const { preview: _, ...metadata } = data;
                meta = metadata;
              }
            } else meta = await browserMetadata(file, caps.inputPixels);
            valid.push({
              id: crypto.randomUUID(),
              file,
              url: preview ?? URL.createObjectURL(file),
              meta,
              status: "ready",
            });
          } catch (e) {
            notify(
              e instanceof Error ? e.message : "Could not upload this image.",
              true,
            );
          }
        }
        useStudio.getState().addItems(valid);
        if (valid.length)
          notify(
            `${valid.length === 1 ? "Image" : `${valid.length} images`} added to your workspace.`,
          );
      } finally {
        uploadingRef.current = false;
        setUploading(false);
      }
    },
    [caps, notify],
  );
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop: (files) => void addFiles(files),
    onDropRejected: () =>
      notify("Choose supported image files within the upload limit.", true),
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/avif": [".avif"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
    },
    maxSize: caps.maxBytes,
    noClick: true,
    noKeyboard: true,
    disabled: busy || uploading,
  });
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (images.length) {
        e.preventDefault();
        void addFiles(images);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettings(false);
        setShowHistory(false);
        setShowFeatures(false);
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "o") {
        e.preventDefault();
        open();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        runRef.current();
      }
      if (
        e.key.toLowerCase() === "d" &&
        useStudio.getState().items.some((i) => i.result)
      ) {
        e.preventDefault();
        downloadRef.current();
      }
    };
    document.addEventListener("paste", paste);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("paste", paste);
      document.removeEventListener("keydown", key);
    };
  }, [addFiles, open]);
  async function analyze() {
    if (!prompt.trim() || analyzing || busy) return;
    setAnalyzing(true);
    s.chat("user", prompt);
    const text = prompt;
    setPrompt("");
    try {
      let result;
      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            currentPlan: useStudio.getState().plan,
            imageMetadata: useStudio.getState().items.map(({meta})=>({width:meta.width,height:meta.height,bytes:meta.bytes,format:meta.format})),
            messages: useStudio
              .getState()
              .chats.slice(-8)
              .map((m) => ({ ...m, text: m.text.slice(0, 2000) })),
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error);
        }
        result = await response.json();
      } catch {
        result = {
          ...parsePrompt(text, useStudio.getState().plan),
          mode: "offline",
        };
      }
      s.setPlan(result.plan, text);
      s.setQuestions(result.questions);
      s.setMode(result.mode);
      s.chat(
        "assistant",
        result.questions.length ? result.questions.join(" ") : result.message,
      );
      if (!result.questions.length) {
        notify(
          result.mode === "ai"
            ? "AI understood your request."
            : "Smart plan ready to review.",
        );
        if (
          !useStudio.getState().preferences.confirmPlan &&
          useStudio.getState().items.length
        )
          setTimeout(() => runRef.current(), 0);
      }
    } finally {
      setAnalyzing(false);
    }
  }
  async function processBatch(onlyId?: string) {
    const state = useStudio.getState();
    if (busyRef.current || analyzing || uploading) return;
    if (prompt.trim()) {
      notify("Analyze your new instruction before generating.", true);
      promptRef.current?.focus();
      return;
    }
    if (state.questions.length) {
      notify("Resolve the plan questions or correct the settings first.", true);
      return;
    }
    const items = onlyId
      ? state.items.filter((i) => i.id === onlyId)
      : state.items;
    if (!items.length) {
      open();
      return;
    }
    // Shared validation is bundled so browser processing also works offline.
    const parsed = planSchema.safeParse(state.plan);
    if (!parsed.success) {
      notify(parsed.error.issues[0].message, true);
      setSettings(true);
      return;
    }
    const plan = { ...parsed.data };
    busyRef.current = true;
    setBusy(true);
    setCompleted(0);
    let cursor = 0,
      success = 0,
      fail = 0;
    const used = new Set<string>();
    const processOne = async () => {
      while (cursor < items.length) {
        const index = cursor++,
          item = items[index];
        state.updateItem(item.id, { status: "processing", error: undefined });
        try {
          let result: Omit<Result, "url" | "filename" | "plan">;
          if (navigator.onLine) {
            const form = new FormData();
            form.append("image", item.file);
            form.append("plan", JSON.stringify(plan));
            let response: Response | null = null;
            try {
              response = await fetch("/api/process", {
                method: "POST",
                body: form,
              });
            } catch {}
            if (response) {
              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Image processing failed.");
              }
              const metadata = JSON.parse(
                decodeURIComponent(
                  response.headers.get("X-Image-Result") || "",
                ),
              );
              const blob = await response.blob();
              if (blob.size !== metadata.bytes)
                throw new Error("The download was interrupted. Please retry.");
              result = { ...metadata, blob, engine: "server" };
            } else result = await processInBrowser(item.file, plan);
          } else result = await processInBrowser(item.file, plan);
          const output: Result = {
            ...result,
            url: URL.createObjectURL(result.blob),
            filename: outputName(
              item,
              result,
              index,
              state.preferences.filenamePattern,
              used,
            ),
            plan,
          };
          state.updateItem(item.id, { status: "done", result: output });
          success++;
        } catch (e) {
          state.updateItem(item.id, {
            status: "error",
            error:
              e instanceof Error
                ? e.message
                : "Processing failed. Please retry.",
          });
          fail++;
        }
        setCompleted((n) => n + 1);
      }
    };
    try {
      await Promise.all(
        Array.from({ length: Math.min(2, items.length) }, () => processOne()),
      );
      notify(
        `${success} image${success === 1 ? "" : "s"} processed${fail ? ` · ${fail} failed. Use Retry to try again.` : "."}`,
        !!fail,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const selected = s.items.find((i) => i.id === s.selected),
    ready = s.items.filter((i) => i.result),
    totalSaved = s.items.reduce(
      (sum, i) =>
        sum + Math.max(0, i.meta.bytes - (i.result?.bytes ?? i.meta.bytes)),
      0,
    );
  const download = () => {
    if (selected?.result) {
      try {
        saveBlob(selected.result.blob, selected.result.filename);
      } catch {
        notify("Download failed. Please retry.", true);
      }
    }
  };
  runRef.current = () => void processBatch();
  downloadRef.current = download;
  async function zip() {
    setZipBusy(true);
    try {
      const bytes = await createZip(
        ready.map((i) => ({ name: i.result!.filename, data: i.result!.blob })),
      );
      saveBlob(
        new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
        "ACE-Studio-images.zip",
      );
      notify("Your ZIP is ready.");
    } catch {
      notify("Could not create ZIP. Try individual downloads.", true);
    } finally {
      setZipBusy(false);
    }
  }
  async function sample() {
    try {
      const response = await fetch("/sample.jpg");
      if (!response.ok) throw new Error();
      await addFiles([
        new File([await response.blob()], "aurora-landscape.jpg", {
          type: "image/jpeg",
        }),
      ]);
    } catch {
      notify("The sample could not be loaded. Upload your own image.", true);
    }
  }
  const go = () => {
    workspaceRef.current?.scrollIntoView({
      behavior: reduceMotion ? "instant" : "smooth",
      block: "start",
    });
    if (!s.items.length) open();
    else promptRef.current?.focus();
  };
  return (
    <main>
      {home ? (
        <section className="hero">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="hero-badge">
              <span className="pulse-dot" />
              <Sparkles size={12} /> A LITTLE AI. A LOT OF POSSIBILITY.
              <ArrowUpRight size={12} />
            </span>
            <h1>
              Transform Images
              <br />
              With <span className="gradient-word">Words.</span>
            </h1>
            <p>
              Upload your images, describe what you need,
              <br className="desktop-break" /> and let AI handle the rest.
            </p>
            <div className="hero-actions">
              <button className="btn primary" onClick={go}>
                Start Creating <ArrowRight size={16} />
              </button>
              <button
                className="btn subtle"
                onClick={() => setShowFeatures(!showFeatures)}
              >
                Explore Features <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="hero-proof">
              <span>
                <ShieldCheck size={13} />
                Private & secure
              </span>
              <span>
                <Zap size={13} />
                Precision processing
              </span>
              <span>
                <Layers3 size={13} />
                Batch ready
              </span>
            </div>
          </motion.div>
          <div className="hero-orbit" aria-hidden="true">
            <div />
            <div />
            <span>✦</span>
          </div>
        </section>
      ) : (
        <section className="page-intro">
          <span className="eyebrow">YOUR CREATIVE WORKSPACE</span>
          <h1>
            {batch
              ? "One instruction. Every image."
              : "Make every pixel count."}
          </h1>
          <p>
            {batch
              ? "Apply a precise plan to your whole batch. Download individually or together."
              : "Describe what you need. Your original stays untouched."}
          </p>
        </section>
      )}
      {showFeatures && (
        <section className="feature-grid" aria-label="Features">
          {[
            {
              icon: WandSparkles,
              title: "Speak your language",
              text: "English, Roman Urdu, Urdu, or German. Gemini when configured; a local parser when you need it.",
            },
            {
              icon: SlidersHorizontal,
              title: "Every pixel, considered",
              text: "Accurate dimensions, measured file sizes, transparent backgrounds, and explicit cropping controls.",
            },
            {
              icon: ShieldCheck,
              title: "Yours from start to finish",
              text: "Images are processed in memory. Only your text goes to Gemini. Original files stay unchanged.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div className="panel" key={title}>
              <Icon size={22} />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </section>
      )}
      <div ref={workspaceRef} id="workspace" className="workspace-container">
        <div className="workspace-top">
          <div className="workspace-label">
            <span className="small-logo">✦</span>
            <h2>{batch ? "Batch studio" : "The creative workspace"}</h2>
            <span className="tiny-badge">ALL IN ONE PLACE</span>
          </div>
          <div className="workspace-tools">
            <button
              aria-label="Undo settings"
              disabled={!s.past.length || busy}
              onClick={s.undo}
            >
              <Undo2 size={15} />
            </button>
            <button
              aria-label="Redo settings"
              disabled={!s.future.length || busy}
              onClick={s.redo}
            >
              <Redo2 size={15} />
            </button>
            <span />
            <button
              aria-label="Show processing history"
              aria-expanded={showHistory}
              onClick={() => setShowHistory(!showHistory)}
            >
              <Clock3 size={15} />
            </button>
          </div>
        </div>
        {showHistory && (
          <section className="history panel">
            <div className="panel-heading">
              <h3>Session history</h3>
              <button className="text-button" onClick={s.clearHistory}>
                Clear history
              </button>
            </div>
            {s.history.length ? (
              s.history.map((h) => (
                <button
                  key={h.id}
                  className="history-row"
                  disabled={busy}
                  onClick={() => s.setPlan(h.plan, "Restored configuration")}
                >
                  <Clock3 size={14} />
                  <span>{h.label}</span>
                  <time>
                    {new Date(h.time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </button>
              ))
            ) : (
              <p>
                Transformations will appear here. Images and prompts are not
                saved between visits.
              </p>
            )}
          </section>
        )}
        <div className="workspace">
          <aside className="upload-panel panel">
            <div className="panel-heading">
              <h2>
                Your images{" "}
                <span className="count-badge">{s.items.length}</span>
              </h2>
              <button
                className="icon-btn"
                aria-label="Add images"
                disabled={busy || uploading}
                onClick={open}
              >
                <Plus size={17} />
              </button>
            </div>
            <div
              {...getRootProps({
                className: `drop-zone ${isDragActive ? "dragging" : ""}`,
              })}
            >
              <input {...getInputProps({ "aria-label": "Upload images" })} />
              <button
                className="drop-button"
                disabled={busy || uploading}
                onClick={open}
              >
                <span className="upload-icon">
                  {uploading ? (
                    <Loader2 className="spin" size={23} />
                  ) : (
                    <UploadCloud size={25} />
                  )}
                </span>
                <strong>
                  {isDragActive
                    ? "Drop them here."
                    : uploading
                      ? "Reading your images…"
                      : "Drop your images here"}
                </strong>
                <span>
                  or <em>browse files</em>
                </span>
                <small>
                  JPG, PNG, WebP, AVIF{caps.heif ? ", HEIC*" : ""}
                  <br />
                  Up to {caps.maxImages} images · {bytesLabel(caps.maxBytes)}{" "}
                  each
                </small>
              </button>
            </div>
            <p className="paste-hint">
              <span>⌘ / Ctrl + V</span> to paste an image
            </p>
            <div className="queue-header">
              <span>
                {s.items.length ? "UPLOAD QUEUE" : "READY WHEN YOU ARE"}
              </span>
              {s.items.length > 0 && (
                <button disabled={busy || uploading} onClick={s.clear}>
                  Clear all
                </button>
              )}
            </div>
            <div className="image-queue">
              {s.items.length ? (
                s.items.map((item) => (
                  <div
                    key={item.id}
                    className={`queue-item ${s.selected === item.id ? "selected" : ""}`}
                  >
                    <button
                      className="queue-select"
                      onClick={() => s.select(item.id)}
                      aria-label={`Preview ${item.file.name}`}
                    >
                      <img
                        src={item.url}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />
                      <span>
                        <strong>{item.file.name}</strong>
                        <small>
                          {item.meta.width} × {item.meta.height} ·{" "}
                          {bytesLabel(item.result?.bytes ?? item.meta.bytes)}
                        </small>
                        <small className={`queue-status ${item.status}`}>
                          {item.status === "done"
                            ? "Processed"
                            : item.status === "processing"
                              ? "Processing…"
                              : item.status === "error"
                                ? "Needs attention"
                                : item.meta.format.toUpperCase()}
                        </small>
                      </span>
                    </button>
                    <button
                      className="remove-image"
                      disabled={busy}
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => s.remove(item.id)}
                    >
                      <X size={13} />
                    </button>
                    {item.status === "error" && (
                      <div className="queue-error">
                        <span>{item.error}</span>
                        <button
                          disabled={busy}
                          onClick={() => void processBatch(item.id)}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {item.result && (
                      <button
                        className="queue-download"
                        aria-label={`Download ${item.result.filename}`}
                        onClick={() =>
                          saveBlob(item.result!.blob, item.result!.filename)
                        }
                      >
                        <Download size={13} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-queue">
                  <ImageIcon size={20} />
                  <p>
                    Your ideas deserve
                    <br />a clearer picture.
                  </p>
                </div>
              )}
            </div>
            <div className="upload-privacy">
              <LockKeyhole size={15} />
              <div>
                <strong>Your images, your business.</strong>
                <p>
                  Processed in memory.
                  <br />
                  Never sent to an AI model.
                </p>
              </div>
            </div>
          </aside>
          <Preview
            item={selected}
            onSample={() => void sample()}
            onDownload={download}
            busy={busy}
          />
          <aside className="ai-panel panel">
            <div className="panel-heading">
              <h2>
                <Sparkles size={17} className="accent-violet" />
                AI Assistant
              </h2>
              <span className={`mode-badge ${s.mode}`}>
                <i />
                {s.mode === "ai" ? "AI Mode" : "Offline Smart Mode"}
              </span>
            </div>
            <div className="assistant-welcome">
              <div className="assistant-avatar">
                <Sparkles size={19} />
              </div>
              <div>
                <strong>A few words. A perfect fit.</strong>
                <p>
                  Tell me what you have in mind.
                  <br />
                  I’ll take care of the details.
                </p>
              </div>
            </div>
            {s.chats.length > 0 && (
              <div className="chat-history" aria-live="polite">
                {s.chats.slice(-4).map((c, i) => (
                  <div key={i} className={`chat-message ${c.role}`}>
                    <small>
                      {c.role === "user"
                        ? "YOU"
                        : s.mode === "ai"
                          ? "AI ASSISTANT"
                          : "SMART ASSISTANT"}
                    </small>
                    <p>{c.text}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="prompt-box">
              <textarea
                ref={promptRef}
                aria-label="Image processing instruction"
                dir="auto"
                maxLength={2000}
                disabled={analyzing || busy}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  s.preferences.language === "de"
                    ? "z. B. Auf 600x600 verkleinern und unter 100KB komprimieren…"
                    : s.preferences.language === "ur"
                      ? "میری تصویر کو 100KB سے کم کر دیں…"
                      : "e.g. Make this 600×600, convert to JPG, and keep it under 100KB…"
                }
              />
              <div className="prompt-bottom">
                <span>EN · اردو · Roman Urdu · DE</span>
                <button
                  aria-label="Analyze instruction"
                  disabled={!prompt.trim() || analyzing || busy}
                  onClick={() => void analyze()}
                >
                  {analyzing ? (
                    <Loader2 className="spin" size={15} />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                </button>
              </div>
            </div>
            <div className="suggestion-chips">
              {suggestions.map((text) => (
                <button
                  disabled={busy || analyzing}
                  key={text}
                  onClick={() => {
                    setPrompt(
                      text === "Passport dimensions"
                        ? "Make this suitable for a passport photo"
                        : text,
                    );
                    promptRef.current?.focus();
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
            <div className="plan-heading">
              <span>
                <WandSparkles size={14} />
                {s.history.length
                  ? "YOUR PROCESSING PLAN"
                  : "START WITH A SIMPLE PLAN"}
              </span>
              <button
                className={settings ? "active" : ""}
                onClick={() => setSettings(!settings)}
                aria-expanded={settings}
              >
                <SlidersHorizontal size={13} />
                Edit
              </button>
            </div>
            <fieldset disabled={busy || analyzing} className="plan-fieldset">
              {settings ? (
                <PlanEditor />
              ) : (
                <div className="plan-summary">
                  {planSummary(s.plan).map((text, i) => (
                    <div key={text}>
                      <span className="plan-check">
                        <Check size={11} />
                      </span>
                      <span>
                        {text.split(": ")[0]}
                        <strong>{text.split(": ").slice(1).join(": ")}</strong>
                      </span>
                      {i === 0 && (
                        <span className="mini-badge">
                          {s.plan.format === "original" ? "AUTO" : "SET"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
            {s.questions.length > 0 && (
              <div className="clarification" role="status">
                <AlertTriangle size={16} />
                <div>
                  <strong>A quick clarification</strong>
                  {s.questions.map((q) => (
                    <p key={q}>{q}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="generate-wrap">
              <button
                className="btn primary generate"
                disabled={
                  busy || analyzing || uploading || !!s.questions.length
                }
                onClick={() => void processBatch()}
              >
                {busy ? (
                  <>
                    <Loader2 className="spin" size={17} />
                    Processing {completed}/{s.items.length}
                  </>
                ) : (
                  <>
                    <Sparkles size={17} />
                    Generate{" "}
                    {s.items.length > 1 ? `${s.items.length} Images` : "Image"}
                    <span>⌘ ↵</span>
                  </>
                )}
              </button>
              {busy && (
                <progress
                  aria-label="Completed image processing"
                  value={completed}
                  max={s.items.length}
                />
              )}
              <p>
                <ShieldCheck size={11} />
                Your original always stays untouched.
              </p>
            </div>
            <details className="presets">
              <summary>
                <BookmarkPlus size={14} />
                Saved presets <ChevronDown size={12} />
              </summary>
              <div className="preset-save">
                <input
                  aria-label="Preset name"
                  placeholder="Name this configuration"
                  maxLength={40}
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
                <button
                  className="icon-btn"
                  aria-label="Save preset"
                  disabled={!presetName.trim()}
                  onClick={() => {
                    s.savePreset(presetName.trim());
                    setPresetName("");
                    notify("Preset saved.");
                  }}
                >
                  <Plus size={15} />
                </button>
              </div>
              {s.presets.map((p) => (
                <div className="preset-row" key={p.name}>
                  <button
                    disabled={busy}
                    onClick={() => s.setPlan(p.plan, `Preset: ${p.name}`)}
                  >
                    {p.name}
                  </button>
                  <button
                    aria-label={`Delete preset ${p.name}`}
                    onClick={() => s.deletePreset(p.name)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </details>
          </aside>
        </div>
        <div className="batch-bar">
          <span>
            <span className="status-dot" />
            {busy
              ? "Processing your images"
              : ready.length
                ? `${ready.length} of ${s.items.length} ready · ${bytesLabel(totalSaved)} saved`
                : s.items.length
                  ? `${s.items.length} image${s.items.length === 1 ? "" : "s"} in your workspace`
                  : "Ready for your next idea."}
            {s.items.some((i) => i.status === "error") &&
              ` · ${s.items.filter((i) => i.status === "error").length} failed`}
          </span>
          <div>
            {ready.length > 0 && (
              <>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    s.setPlan({ ...defaultPlan }, "New configuration");
                    notify(
                      "Settings reset. Your original images are ready to edit again.",
                    );
                  }}
                >
                  Edit again
                </button>
                <button
                  className="btn secondary small"
                  disabled={zipBusy || busy}
                  onClick={() => void zip()}
                >
                  {zipBusy ? (
                    <Loader2 className="spin" size={14} />
                  ) : (
                    <Download size={14} />
                  )}
                  Download all{ready.length > 1 ? " as ZIP" : ""}
                </button>
              </>
            )}
            <span className="engine-label">
              <Zap size={12} />
              Built for the details.
            </span>
          </div>
        </div>
      </div>
      <section className="bottom-benefits">
        <span>
          <CheckCircle2 size={14} />
          Real pixels. Real results.
        </span>
        <span>
          <ShieldCheck size={14} />
          No account needed
        </span>
        <span>
          <Layers3 size={14} />
          One image or twenty
        </span>
        <span>
          <Sparkles size={14} />
          Your language. Your workflow.
        </span>
      </section>
    </main>
  );
}
