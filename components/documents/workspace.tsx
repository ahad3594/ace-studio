"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  UploadCloud,
  Plus,
  X,
  FileText,
  ImageIcon,
  Download,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  Check,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BookmarkPlus,
  Trash2,
  Workflow,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type { Tool } from "@/lib/documents/catalog";
import { toolBySlug, workflowTools } from "@/lib/documents/catalog";
import {
  defaultDocumentOptions,
  documentRequestSchema,
  workflowStepSchema,
} from "@/lib/documents/schema";
import type { DocumentOptions } from "@/lib/documents/schema";
import type {
  DocumentMeta,
  DocumentPreview,
  UploadedDocument,
  DocumentCapabilities,
} from "@/lib/documents/types";
import { z } from "zod";
import { bytesLabel, saveBlob } from "@/lib/client";
import { ToolIcon } from "./icons";
import { CommandBox } from "./command";
import { DocumentSettings, visualTools } from "./settings";
import { SignaturePad } from "./signature";
import { useToast } from "@/components/ui";
type Step = z.infer<typeof workflowStepSchema>;
interface DownloadResult {
  blob: Blob;
  filename: string;
  bytes: number;
  mime: string;
  warnings: string[];
  stats: Record<string, unknown>;
  fileCount: number;
  preview?: DocumentPreview;
}
export function DocumentWorkspace({ tool }: { tool: Tool }) {
  const notify = useToast();
  const [files, setFiles] = useState<UploadedDocument[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [o, setO] = useState<DocumentOptions>({
      ...defaultDocumentOptions,
      pages: tool.slug === "remove-pages" ? "1" : "all",
    }),
    [busy, setBusy] = useState<"upload" | "process" | null>(null),
    [caps, setCaps] = useState<DocumentCapabilities | null>(null),
    [preview, setPreview] = useState<DocumentPreview | null>(null),
    [page, setPage] = useState(1),
    [rendering, setRendering] = useState(false),
    [result, setResult] = useState<DownloadResult | null>(null),
    [showResult, setShowResult] = useState(false),
    [questions, setQuestions] = useState<string[]>([]),
    [steps, setSteps] = useState<Step[]>([]),
    [workflowName, setWorkflowName] = useState(""),
    [saved, setSaved] = useState<{ name: string; steps: Step[] }[]>([]),
    [draft, setDraft] = useState<DocumentOptions["rect"] | null>(null),
    [signature, setSignature] = useState<Blob | null>(null),
    [confirmPassword, setConfirmPassword] = useState("");
  const filesRef = useRef(files),
    busyRef = useRef(false),
    oRef = useRef(o),
    selectedRef = useRef(selected),
    resultRef = useRef(result),
    abort = useRef<AbortController | null>(null),
    previewSequence = useRef(0),
    startPoint = useRef<{ x: number; y: number } | null>(null),
    previewRef = useRef<HTMLDivElement>(null),
    runRef = useRef<() => void>(() => {});
  filesRef.current = files;
  oRef.current = o;
  selectedRef.current = selected;
  resultRef.current = result;
  useEffect(() => {
    void fetch("/api/documents/capabilities")
      .then((r) => r.json())
      .then(setCaps)
      .catch(() =>
        setCaps({
          engine: false,
          office: false,
          ocr: false,
          archive: false,
          ai: false,
        }),
      );
    try {
      const p = JSON.parse(
        sessionStorage.getItem("ace-pending-plan") || "null",
      );
      if (p?.tool === tool.slug) {
        const checked = documentRequestSchema.safeParse({
          tool: tool.slug,
          options: p.options,
        });
        if (checked.success) setO(checked.data.options);
        sessionStorage.removeItem("ace-pending-plan");
      }
      const stored = JSON.parse(localStorage.getItem("ace-workflows") || "[]");
      if (Array.isArray(stored))
        setSaved(
          stored.filter(
            (v) =>
              typeof v.name === "string" &&
              z.array(workflowStepSchema).safeParse(v.steps).success,
          ),
        );
    } catch {}
    return () => {
      abort.current?.abort();
    };
  }, [tool.slug]);
  const selectedFile = files.find((f) => f.id === selected),
    pdf = files.find((f) => f.meta.kind === "pdf"),
    isVisual = visualTools.includes(tool.slug),
    assetTool = ["sign-pdf", "watermark-pdf", "edit-pdf"].includes(tool.slug);
  const change = (next: DocumentOptions) => {
    setO(next);
    setQuestions([]);
  };
  async function inspectFile(file: File): Promise<DocumentMeta> {
    const form = new FormData();
    form.append("files", file);
    form.append("options", JSON.stringify({ password: oRef.current.password }));
    const response = await fetch("/api/documents/inspect", {
      method: "POST",
      body: form,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "This file could not be read.");
    return data.documents[0];
  }
  const addFiles = useCallback(
    async (uploads: File[]) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy("upload");
      const pending: UploadedDocument[] = [];
      try {
        if (filesRef.current.length + uploads.length > 20)
          notify("Up to 20 files can be added at once.", true);
        for (const file of uploads.slice(0, 20 - filesRef.current.length)) {
          try {
            if (file.size > 25 * 1024 * 1024)
              throw new Error(`${file.name} exceeds 25 MB.`);
            if (
              filesRef.current.reduce((n, f) => n + f.file.size, 0) +
                pending.reduce((n, f) => n + f.file.size, 0) +
                file.size >
              80 * 1024 * 1024
            )
              throw new Error("The batch exceeds 80 MB.");
            const meta = await inspectFile(file);
            pending.push({ id: crypto.randomUUID(), file, meta });
          } catch (e) {
            notify(
              e instanceof Error ? e.message : "File could not be added.",
              true,
            );
          }
        }
        setFiles((current) => [...current, ...pending]);
        setSelected((current) => current ?? pending[0]?.id ?? null);
        if (pending.length)
          notify(
            `${pending.length} file${pending.length === 1 ? "" : "s"} added. Originals stay unchanged.`,
          );
      } finally {
        busyRef.current = false;
        setBusy(null);
      }
    },
    [notify],
  );
  const accept: Record<string, string[]> =
    tool.input === "image"
      ? {
          "image/jpeg": [".jpg", ".jpeg"],
          "image/png": [".png"],
          "image/webp": [".webp"],
          "image/avif": [".avif"],
        }
      : tool.input === "office"
        ? {
            "application/octet-stream":
              tool.slug === "word-to-pdf"
                ? [".doc", ".docx", ".odt"]
                : tool.slug === "excel-to-pdf"
                  ? [".xls", ".xlsx", ".ods"]
                  : [".ppt", ".pptx", ".odp"],
          }
        : assetTool
          ? {
              "application/pdf": [".pdf"],
              "image/png": [".png"],
              "image/jpeg": [".jpg", ".jpeg"],
              "image/webp": [".webp"],
            }
          : { "application/pdf": [".pdf"] };
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop: (items) => void addFiles(items),
    onDropRejected: () =>
      notify("Choose supported files under 25 MB each.", true),
    accept,
    maxSize: 25 * 1024 * 1024,
    noClick: true,
    noKeyboard: true,
    disabled: !!busy,
  });
  async function loadPreview(file: UploadedDocument, index: number) {
    const sequence = ++previewSequence.current;
    setPage(index);
    setRendering(true);
    setShowResult(false);
    try {
      if (file.meta.kind !== "pdf") {
        setPreview(file.meta.previews[0] ?? null);
        return;
      }
      const form = new FormData();
      form.append("files", file.file);
      form.append(
        "options",
        JSON.stringify({ page: index, password: oRef.current.password }),
      );
      const response = await fetch("/api/documents/preview", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (sequence === previewSequence.current) setPreview(data);
    } catch (e) {
      if (sequence === previewSequence.current) {
        setPreview(file.meta.previews.find((p) => p.page === index) ?? null);
        notify(
          e instanceof Error ? e.message : "Preview could not be loaded.",
          true,
        );
      }
    } finally {
      if (sequence === previewSequence.current) setRendering(false);
    }
  }
  useEffect(() => {
    const file = filesRef.current.find((f) => f.id === selected);
    setPreview(null);
    if (file && !file.meta.locked) void loadPreview(file, 1);
  }, [selected, selectedFile?.meta.locked]);
  function move(index: number, direction: number) {
    setFiles((current) => {
      const next = [...current],
        other = index + direction;
      if (other < 0 || other >= next.length) return current;
      [next[index], next[other]] = [next[other], next[index]];
      return next;
    });
  }
  async function refresh() {
    if (!selectedFile || busyRef.current) return;
    busyRef.current = true;
    setBusy("upload");
    try {
      const meta = await inspectFile(selectedFile.file);
      setFiles((current) =>
        current.map((f) => (f.id === selectedFile.id ? { ...f, meta } : f)),
      );
      if (!meta.locked) await loadPreview({ ...selectedFile, meta }, 1);
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Unable to refresh this PDF.",
        true,
      );
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }
  async function runDocumentTool() {
    if (busyRef.current) return;
    if (!caps?.engine) {
      notify(
        "The document engine is not ready. Install the desktop package or run document setup.",
        true,
      );
      return;
    }
    if (tool.needs && tool.needs !== "ai" && !caps[tool.needs]) {
      notify(
        `This tool needs ${tool.needs === "office" ? "LibreOffice" : tool.needs === "ocr" ? "OCR language data" : "Ghostscript and an ICC profile"}. See Settings and the setup guide.`,
        true,
      );
      return;
    }
    if (tool.slug === "translate-pdf" && (!caps.ai || !o.allowAI)) {
      notify(
        "Connect Gemini and allow sharing extracted text to translate this PDF.",
        true,
      );
      return;
    }
    if (tool.input !== "html" && !files.length) {
      open();
      return;
    }
    if (questions.length) {
      notify(
        "Answer the assistant’s questions or correct the settings first.",
        true,
      );
      return;
    }
    if (tool.slug === "protect-pdf" && o.newPassword !== confirmPassword) {
      notify("The new PDF passwords do not match.", true);
      return;
    }
    const parsed = documentRequestSchema.safeParse({
      tool: tool.slug,
      options: o,
      steps,
    });
    if (!parsed.success) {
      notify(parsed.error.issues[0].message, true);
      return;
    }
    busyRef.current = true;
    setBusy("process");
    setShowResult(false);
    abort.current = new AbortController();
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f.file));
      if (signature && tool.slug === "sign-pdf")
        form.append(
          "files",
          new File([signature], "ACE-signature.png", { type: "image/png" }),
        );
      form.append("settings", JSON.stringify(parsed.data));
      const response = await fetch("/api/documents/process", {
        method: "POST",
        body: form,
        signal: abort.current.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "The document could not be processed.");
      }
      const blob = await response.blob();
      let metadata;
      try {
        metadata = JSON.parse(
          decodeURIComponent(response.headers.get("X-ACE-Result") || ""),
        );
      } catch {
        metadata = {
          warnings: [
            "Result metadata could not be read. The actual file is available below.",
          ],
          stats: {},
          fileCount: 1,
        };
      }
      const filename = decodeURIComponent(
        response.headers.get("X-ACE-Filename") || "ACE-result.pdf",
      );
      const next: DownloadResult = {
        blob,
        filename,
        bytes: blob.size,
        mime: blob.type,
        warnings: metadata.warnings || [],
        stats: metadata.stats || {},
        fileCount: metadata.fileCount || 1,
      };
      setResult(next);
      notify("Your ACE Studio result is ready.");
      if (blob.type === "application/pdf") {
        try {
          const previewForm = new FormData();
          previewForm.append(
            "files",
            new File([blob], filename, { type: blob.type }),
          );
          previewForm.append(
            "options",
            JSON.stringify({
              page: 1,
              password: tool.slug === "protect-pdf" ? o.newPassword : "",
            }),
          );
          const pr = await fetch("/api/documents/preview", {
            method: "POST",
            body: previewForm,
          });
          if (pr.ok) {
            const preview = await pr.json();
            setResult({ ...next, preview });
          }
        } catch {}
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError")
        notify("Processing cancelled. Original files were kept.");
      else
        notify(
          e instanceof Error
            ? e.message
            : "Processing failed. Please try again.",
          true,
        );
    } finally {
      busyRef.current = false;
      setBusy(null);
      abort.current = null;
    }
  }
  runRef.current = () => void runDocumentTool();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "o") {
        e.preventDefault();
        open();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        runRef.current();
      }
      if (e.key.toLowerCase() === "d" && resultRef.current) {
        e.preventDefault();
        saveBlob(resultRef.current.blob, resultRef.current.filename);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);
  function pointer(event: React.PointerEvent<HTMLDivElement>) {
    const r = previewRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - r.top) / r.height) * 100)),
    };
  }
  function saveWorkflow() {
    if (!workflowName.trim() || !steps.length) return;
    const safe = steps.map((s) => ({
      ...s,
      options: {
        ...s.options,
        password: "",
        newPassword: "",
        values: {},
        search: "",
      },
    }));
    const next = [
      ...saved.filter((s) => s.name !== workflowName.trim()),
      { name: workflowName.trim(), steps: safe },
    ].slice(-20);
    setSaved(next);
    localStorage.setItem("ace-workflows", JSON.stringify(next));
    setWorkflowName("");
    notify(
      "Workflow saved on this device. Passwords and private form values were excluded.",
    );
  }
  const currentPreview = showResult ? result?.preview : preview;
  const selection = draft ?? o.rect;
  return (
    <main className="document-workspace">
      <Link href="/" className="back-to-tools">
        <ArrowLeft size={14} />
        All tools<span>/</span>
        {tool.category}
      </Link>
      <section className="document-intro">
        <span className={`large-tool-icon tone-${tool.color}`}>
          <ToolIcon name={tool.icon} size={29} />
        </span>
        <div>
          <span className="ace-kicker">
            ACE STUDIO · {tool.category.toUpperCase()}
          </span>
          <h1>{tool.title}</h1>
          <p>{tool.description}</p>
        </div>
        <span className="local-processing">
          <ShieldCheck size={14} />
          Your files stay under your control
        </span>
      </section>
      <div className="document-steps">
        <span
          className={
            files.length || tool.input === "html" ? "complete" : "active"
          }
        >
          <i>
            {files.length || tool.input === "html" ? <Check size={12} /> : 1}
          </i>
          Choose files
        </span>
        <b />
        <span className={files.length || tool.input === "html" ? "active" : ""}>
          <i>2</i>Tune your result
        </span>
        <b />
        <span className={result ? "complete" : ""}>
          <i>{result ? <Check size={12} /> : 3}</i>Download
        </span>
      </div>
      <CommandBox
        compact
        currentTool={tool.slug}
        options={o}
        fileTypes={files.map((f) => f.meta.kind)}
        fileInfo={files.map(({meta})=>({kind:meta.kind,pages:meta.pages,width:meta.width,height:meta.height}))}
        onPlan={(plan) => {
          if (plan.tool === tool.slug) {
            setO(plan.options);
            setQuestions(plan.questions);
          }
        }}
      />
      <div className="document-columns">
        <section className="document-main">
          <div className="panel document-upload">
            <div className="panel-heading">
              <h2>
                <FileText size={16} />
                Your source files{" "}
                <span className="count-badge">{files.length}</span>
              </h2>
              <div className="document-queue-actions">
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => {
                    setFiles([]);
                    setSelected(null);
                    setPreview(null);
                    setResult(null);
                    setSignature(null);
                  }}
                >
                  Clear files
                </button>
                {tool.input !== "html" && (
                  <button
                    className="icon-btn"
                    aria-label="Add document files"
                    disabled={!!busy}
                    onClick={open}
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>
            {tool.input !== "html" && (
              <div
                {...getRootProps({
                  className: `document-drop ${isDragActive ? "dragging" : ""}`,
                })}
              >
                <input
                  {...getInputProps({ "aria-label": "Upload document files" })}
                />
                <button onClick={open} disabled={!!busy}>
                  <span>
                    {busy === "upload" ? (
                      <Loader2 className="spin" size={27} />
                    ) : (
                      <UploadCloud size={28} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {busy === "upload"
                        ? "Reading and validating your files…"
                        : isDragActive
                          ? "Drop your files here"
                          : "Drop files here, or browse"}
                    </strong>
                    <p>
                      {tool.input === "image"
                        ? "JPG, PNG, WebP or AVIF"
                        : tool.input === "office"
                          ? "Word, Excel or PowerPoint files, depending on the selected tool"
                          : assetTool
                            ? "PDF + optional image overlay"
                            : "PDF documents"}{" "}
                      · 25 MB per file · 80 MB per job
                    </p>
                  </div>
                </button>
              </div>
            )}
            {tool.input === "html" && (
              <div className="html-source-note">
                <ToolIcon name="code" size={24} />
                <p>
                  Paste your HTML in the settings panel. No file upload is
                  needed.
                </p>
              </div>
            )}
            <div className="document-file-list">
              {files.map((file, index) => (
                <div
                  className={selected === file.id ? "selected" : ""}
                  key={file.id}
                >
                  <button
                    className="document-file-select"
                    aria-label={`Preview document ${file.file.name}`}
                    onClick={() => {
                      setSelected(file.id);
                      setShowResult(false);
                    }}
                  >
                    {file.meta.previews[0] ? (
                      <img src={file.meta.previews[0].image} alt="" />
                    ) : (
                      <FileText size={25} />
                    )}
                    <span>
                      <strong>{file.file.name}</strong>
                      <small>
                        {file.meta.locked
                          ? "Password protected"
                          : file.meta.kind === "pdf"
                            ? `${file.meta.pages} pages`
                            : file.meta.kind === "image"
                              ? `${file.meta.width ?? ""} × ${file.meta.height ?? ""}`
                              : "Office document"}{" "}
                        · {bytesLabel(file.file.size)}
                      </small>
                    </span>
                  </button>
                  <div className="queue-order">
                    <button
                      aria-label={`Move ${file.file.name} up`}
                      disabled={index === 0 || !!busy}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      aria-label={`Move ${file.file.name} down`}
                      disabled={index === files.length - 1 || !!busy}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      aria-label={`Remove document ${file.file.name}`}
                      disabled={!!busy}
                      onClick={() => {
                        setFiles((current) =>
                          current.filter((f) => f.id !== file.id),
                        );
                        if (selected === file.id)
                          setSelected(
                            files.find((f) => f.id !== file.id)?.id ?? null,
                          );
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!files.length && tool.input === "pdf" && (
              <button
                className="sample-document"
                disabled={!!busy}
                onClick={async () => {
                  try {
                    const response = await fetch("/sample-document.pdf");
                    if (!response.ok) throw new Error();
                    await addFiles([
                      new File([await response.blob()], "ACE-sample.pdf", {
                        type: "application/pdf",
                      }),
                    ]);
                  } catch {
                    notify(
                      "Sample is unavailable. Choose your own file.",
                      true,
                    );
                  }
                }}
              >
                Try with an ACE sample document
                <ArrowUpRightIcon />
              </button>
            )}
          </div>
          {tool.slug === "sign-pdf" && <SignaturePad onChange={setSignature} />}
          {tool.input !== "html" && (
            <section className="panel document-canvas-panel">
              <div className="panel-heading">
                <h2>{showResult ? "Processed result" : "Document preview"}</h2>
                <div className="preview-switch">
                  <button
                    className={!showResult ? "active" : ""}
                    onClick={() => setShowResult(false)}
                  >
                    Original
                  </button>
                  <button
                    disabled={!result?.preview}
                    className={showResult ? "active" : ""}
                    onClick={() => setShowResult(true)}
                  >
                    Result
                  </button>
                  <button
                    className="icon-btn"
                    disabled={!selectedFile || !!busy}
                    aria-label="Refresh document preview"
                    onClick={() => void refresh()}
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
              <div
                className={`document-canvas ${isVisual && !showResult ? "can-select" : ""}`}
              >
                {currentPreview ? (
                  <div
                    className="document-page"
                    ref={previewRef}
                    onPointerDown={(event) => {
                      if (!isVisual || showResult || busy) return;
                      event.preventDefault();
                      startPoint.current = pointer(event);
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDraft(null);
                    }}
                    onPointerMove={(event) => {
                      if (!startPoint.current) return;
                      const end = pointer(event),
                        start = startPoint.current;
                      setDraft({
                        x: Math.min(start.x, end.x),
                        y: Math.min(start.y, end.y),
                        width: Math.abs(end.x - start.x),
                        height: Math.abs(end.y - start.y),
                      });
                    }}
                    onPointerUp={() => {
                      if (draft && draft.width >= 1 && draft.height >= 1)
                        change({ ...o, rect: draft });
                      startPoint.current = null;
                      setDraft(null);
                    }}
                    onPointerCancel={() => {
                      startPoint.current = null;
                      setDraft(null);
                    }}
                  >
                    <img
                      src={currentPreview.image}
                      alt={
                        showResult
                          ? "Rendered processed PDF page"
                          : `Original document page ${page}`
                      }
                      draggable={false}
                    />
                    {isVisual && !showResult && (
                      <div
                        className={`document-selection ${tool.slug === "redact-pdf" ? "redaction" : ""}`}
                        style={{
                          left: `${selection.x}%`,
                          top: `${selection.y}%`,
                          width: `${selection.width}%`,
                          height: `${selection.height}%`,
                        }}
                      >
                        <span>
                          {tool.slug === "crop-pdf"
                            ? "Keep this area"
                            : tool.slug === "redact-pdf"
                              ? "Remove content here"
                              : "Selected area"}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="document-empty">
                    <span>
                      <ToolIcon name={tool.icon} size={40} />
                    </span>
                    <h3>
                      {selectedFile?.meta.locked
                        ? "This PDF is protected."
                        : "Your document takes center stage."}
                    </h3>
                    <p>
                      {selectedFile?.meta.locked
                        ? "Enter its password in settings, then refresh the preview."
                        : "Add your files to see real page previews and fine-tune the result."}
                    </p>
                  </div>
                )}
                {rendering && (
                  <div className="document-rendering">
                    <Loader2 className="spin" size={19} />
                    Rendering page…
                  </div>
                )}
              </div>
              {selectedFile?.meta.kind === "pdf" &&
                !showResult &&
                !selectedFile.meta.locked && (
                  <div className="document-page-controls">
                    <button
                      aria-label="Previous PDF page"
                      disabled={page <= 1 || rendering || !!busy}
                      onClick={() => void loadPreview(selectedFile, page - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span>
                      Page {page} of {selectedFile.meta.pages}
                    </span>
                    <button
                      aria-label="Next PDF page"
                      disabled={
                        page >= selectedFile.meta.pages || rendering || !!busy
                      }
                      onClick={() => void loadPreview(selectedFile, page + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                    <span className="selection-hint">
                      {isVisual
                        ? "Drag to select an area. Coordinates use percentages."
                        : "Preview is rendered from your actual file."}
                    </span>
                  </div>
                )}
              {selectedFile?.meta.kind === "pdf" &&
                !showResult &&
                selectedFile.meta.previews.length > 1 && (
                  <div className="document-thumbnails">
                    {selectedFile.meta.previews.map((p) => (
                      <button
                        aria-label={`Select PDF page ${p.page}`}
                        key={p.page}
                        className={p.page === page ? "selected" : ""}
                        disabled={rendering || !!busy}
                        onClick={() => void loadPreview(selectedFile, p.page)}
                      >
                        <img src={p.image} alt="" />
                        <span>{p.page}</span>
                      </button>
                    ))}
                    {selectedFile.meta.pages > 12 && (
                      <small>Use page arrows to reach later pages.</small>
                    )}
                  </div>
                )}
            </section>
          )}
          {result && (
            <section className="panel document-result" aria-live="polite">
              <div className="document-result-heading">
                <span>
                  <CheckCircle2 size={25} />
                </span>
                <div>
                  <h2>Your result is ready.</h2>
                  <p>
                    {result.filename} · {bytesLabel(result.bytes)} ·{" "}
                    {result.fileCount} file{result.fileCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  className="btn primary"
                  aria-label="Download document result"
                  onClick={() => saveBlob(result.blob, result.filename)}
                >
                  <Download size={16} />
                  {result.mime === "application/zip"
                    ? "Download ZIP"
                    : "Download file"}
                </button>
              </div>
              <div className="document-result-stats">
                <span>
                  Source files<strong>{files.length}</strong>
                </span>
                <span>
                  Original bytes
                  <strong>
                    {bytesLabel(files.reduce((sum, f) => sum + f.file.size, 0))}
                  </strong>
                </span>
                <span>
                  Download size<strong>{bytesLabel(result.bytes)}</strong>
                </span>
                {typeof result.stats.mode === "string" && (
                  <span>
                    Engine
                    <strong>
                      {String(result.stats.mode) === "gemini"
                        ? "Gemini"
                        : "Local"}
                    </strong>
                  </span>
                )}
              </div>
              {result.warnings.map((w) => (
                <p className="result-warning" key={w}>
                  <AlertTriangle size={14} />
                  {w}
                </p>
              ))}
            </section>
          )}
        </section>
        <aside className="panel document-options">
          <div className="panel-heading">
            <h2>
              <SlidersHorizontal size={16} />
              Make it yours
            </h2>
            <span className="tiny-badge">REVIEW BEFORE RUNNING</span>
          </div>
          {!caps?.engine && (
            <div className="engine-notice">
              <Loader2 size={16} className={caps ? "" : "spin"} />
              {caps
                ? "Document engine is unavailable. Use the desktop installer or run setup."
                : "Checking your local document engine…"}
            </div>
          )}
          {tool.slug === "workflow" ? (
            <div className="workflow-builder">
              <p>
                Build a sequence of PDF operations. Each step receives the
                previous step’s actual output.
              </p>
              {steps.map((step, index) => (
                <details
                  className="workflow-step"
                  key={index}
                  open={index === steps.length - 1}
                >
                  <summary>
                    <span>{index + 1}</span>
                    {toolBySlug(step.tool)?.title}
                    <button
                      aria-label={`Remove workflow step ${index + 1}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setSteps((current) =>
                          current.filter((_, i) => i !== index),
                        );
                      }}
                    >
                      <X size={13} />
                    </button>
                  </summary>
                  <DocumentSettings
                    slug={step.tool}
                    o={step.options}
                    meta={pdf?.meta}
                    disabled={!!busy}
                    onChange={(options) =>
                      setSteps((current) =>
                        current.map((s, i) =>
                          i === index ? { ...s, options } : s,
                        ),
                      )
                    }
                  />
                </details>
              ))}
              <label className="field">
                <span>Add a step</span>
                <select
                  aria-label="Add workflow step"
                  value=""
                  disabled={steps.length >= 8 || !!busy}
                  onChange={(e) => {
                    if (e.target.value)
                      setSteps((current) => [
                        ...current,
                        {
                          tool: e.target.value as Step["tool"],
                          options: { ...defaultDocumentOptions },
                        },
                      ]);
                  }}
                >
                  <option value="">Choose a PDF operation…</option>
                  {workflowTools.map((slug) => (
                    <option value={slug} key={slug}>
                      {toolBySlug(slug)?.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="workflow-save">
                <input
                  aria-label="Workflow name"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="Name this workflow"
                  maxLength={50}
                />
                <button
                  className="icon-btn"
                  aria-label="Save workflow"
                  disabled={!workflowName.trim() || !steps.length}
                  onClick={saveWorkflow}
                >
                  <BookmarkPlus size={17} />
                </button>
              </div>
              <p className="settings-help">
                Passwords, redaction search text and form values are excluded
                from saved workflows.
              </p>
              {saved.map((workflow) => (
                <div className="saved-workflow" key={workflow.name}>
                  <button
                    disabled={!!busy}
                    onClick={() => setSteps(workflow.steps)}
                  >
                    <Workflow size={14} />
                    {workflow.name}
                    <small>{workflow.steps.length} steps</small>
                  </button>
                  <button
                    aria-label={`Delete workflow ${workflow.name}`}
                    onClick={() => {
                      const next = saved.filter(
                        (v) => v.name !== workflow.name,
                      );
                      setSaved(next);
                      localStorage.setItem(
                        "ace-workflows",
                        JSON.stringify(next),
                      );
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <DocumentSettings
              slug={tool.slug}
              o={o}
              onChange={change}
              meta={pdf?.meta ?? selectedFile?.meta}
              disabled={!!busy}
            />
          )}
          {tool.slug === "protect-pdf" && (
            <label className="field confirm-password">
              <span>Confirm new password</span>
              <input
                aria-label="Confirm new PDF password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
          )}
          {questions.length > 0 && (
            <div className="tool-questions" role="status">
              {questions.map((q) => (
                <p key={q}>{q}</p>
              ))}
            </div>
          )}
          {tool.note && (
            <div className="document-tool-note">
              <ShieldCheck size={16} />
              <p>{tool.note}</p>
            </div>
          )}
          <div className="document-run">
            <button
              className="btn primary"
              aria-label="Run document tool"
              disabled={busy === "upload" || rendering || !caps?.engine}
              onClick={() =>
                busy === "process" ? abort.current?.abort() : void runDocumentTool()
              }
            >
              {busy === "process" ? (
                <>
                  <Loader2 size={17} className="spin" />
                  Cancel processing
                </>
              ) : (
                <>
                  <ToolIcon name={tool.icon} size={17} />
                  {tool.slug === "workflow" ? "Run workflow" : tool.title}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
            <p>
              <ShieldCheck size={11} />
              Creates a new copy. Your originals stay unchanged.
            </p>
            {busy === "process" && (
              <div className="document-pending">
                <span />
                Processing real file contents. This may take a moment for OCR
                and Office documents.
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={12} />;
}
