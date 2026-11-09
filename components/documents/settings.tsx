"use client";
import { useState } from "react";
import { Plus, X, LockKeyhole, ShieldCheck } from "lucide-react";
import type { DocumentOptions } from "@/lib/documents/schema";
import type { DocumentMeta } from "@/lib/documents/types";
import { Field, Switch } from "@/components/ui";
const pageTools = [
  "split-pdf",
  "remove-pages",
  "extract-pages",
  "organize-pdf",
  "ocr-pdf",
  "pdf-to-images",
  "pdf-to-word",
  "pdf-to-powerpoint",
  "pdf-to-excel",
  "rotate-pdf",
  "page-numbers",
  "watermark-pdf",
  "crop-pdf",
  "edit-pdf",
  "sign-pdf",
  "redact-pdf",
  "ai-summarizer",
  "translate-pdf",
  "pdf-to-markdown",
];
export const visualTools = [
  "crop-pdf",
  "redact-pdf",
  "edit-pdf",
  "watermark-pdf",
  "sign-pdf",
  "pdf-forms",
];
export function DocumentSettings({
  slug,
  o,
  onChange,
  meta,
  disabled = false,
}: {
  slug: string;
  o: DocumentOptions;
  onChange: (options: DocumentOptions) => void;
  meta?: DocumentMeta;
  disabled?: boolean;
}) {
  const set = (patch: Partial<DocumentOptions>) => onChange({ ...o, ...patch });
  const [fieldName, setFieldName] = useState(""),
    [fieldType, setFieldType] = useState<"text" | "checkbox">("text");
  return (
    <fieldset disabled={disabled} className="document-settings">
      {pageTools.includes(slug) && (
        <Field
          label={slug === "organize-pdf" ? "New page order" : "Pages"}
          hint={
            slug === "organize-pdf"
              ? "For example 3,1,2,2. Repeated pages are allowed."
              : "Use all, odd, even, or ranges such as 1-3,5."
          }
        >
          <input
            aria-label="Page selection"
            value={o.pages}
            onChange={(e) => set({ pages: e.target.value })}
          />
        </Field>
      )}
      {slug === "split-pdf" && (
        <Field
          label="Page groups (optional)"
          hint="Separate output files with semicolons: 1-3;4-5. Leave empty to split every chosen page."
        >
          <input
            placeholder="1-3;4-5"
            value={o.groups}
            onChange={(e) => set({ groups: e.target.value })}
          />
        </Field>
      )}
      {slug === "rotate-pdf" && (
        <Field label="Rotate clockwise">
          <select
            value={o.rotation}
            onChange={(e) =>
              set({ rotation: +e.target.value as 90 | 180 | 270 })
            }
          >
            <option value="90">90°</option>
            <option value="180">180°</option>
            <option value="270">270°</option>
          </select>
        </Field>
      )}
      {["images-to-pdf", "scan-to-pdf"].includes(slug) && (
        <>
          <div className="field-grid two">
            <Field label="Page size">
              <select
                value={o.paper}
                onChange={(e) =>
                  set({ paper: e.target.value as DocumentOptions["paper"] })
                }
              >
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
                <option value="original">Match image dimensions</option>
              </select>
            </Field>
            <Field label="Orientation">
              <select
                value={o.orientation}
                onChange={(e) =>
                  set({
                    orientation: e.target
                      .value as DocumentOptions["orientation"],
                  })
                }
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </Field>
          </div>
          <Field label="Page margin (points)">
            <input
              type="number"
              min="0"
              max="100"
              value={o.margin}
              onChange={(e) => set({ margin: +e.target.value })}
            />
          </Field>
        </>
      )}
      {slug === "compress-pdf" && (
        <>
          <Field label="Compression mode">
            <select
              value={o.compression}
              onChange={(e) =>
                set({
                  compression: e.target.value as DocumentOptions["compression"],
                })
              }
            >
              <option value="lossless">Lossless · keep content quality</option>
              <option value="balanced">Balanced · recompress images</option>
              <option value="strong">Strong · smaller embedded images</option>
            </select>
          </Field>
          <Field
            label="Target maximum size (KB)"
            hint="A goal, not a guaranteed result. We report measured output bytes."
          >
            <input
              type="number"
              min="1"
              placeholder="No target"
              value={o.targetKB ?? ""}
              onChange={(e) =>
                set({ targetKB: e.target.value ? +e.target.value : null })
              }
            />
          </Field>
        </>
      )}
      {slug === "pdf-to-images" && (
        <>
          <div className="field-grid two">
            <Field label="Image format">
              <select
                value={o.format}
                onChange={(e) =>
                  set({ format: e.target.value as DocumentOptions["format"] })
                }
              >
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
              </select>
            </Field>
            <Field label="Resolution (DPI)">
              <select
                value={o.dpi}
                onChange={(e) => set({ dpi: +e.target.value })}
              >
                {[72, 96, 144, 200, 300].map((v) => (
                  <option key={v} value={v}>
                    {v} DPI
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Switch
            label="Extract embedded images instead of pages"
            checked={o.extractImages}
            onChange={(v) => set({ extractImages: v })}
          />
        </>
      )}
      {slug === "pdf-to-powerpoint" && (
        <Field label="Slide content">
          <select
            value={o.slideMode}
            onChange={(e) =>
              set({ slideMode: e.target.value as DocumentOptions["slideMode"] })
            }
          >
            <option value="editable">Editable text and images</option>
            <option value="visual">Page images · preserve appearance</option>
          </select>
        </Field>
      )}
      {["pdf-to-word", "ocr-pdf"].includes(slug) && (
        <>
          {slug === "pdf-to-word" && (
            <Switch
              label="Run OCR on scanned pages first"
              checked={o.ocr}
              onChange={(v) => set({ ocr: v })}
            />
          )}
          <Field label="OCR language">
            <select
              value={o.language}
              onChange={(e) =>
                set({ language: e.target.value as DocumentOptions["language"] })
              }
            >
              <option value="eng">English</option>
              <option value="deu">German</option>
              <option value="urd">Urdu</option>
              <option value="eng+urd">English + Urdu</option>
            </select>
          </Field>
        </>
      )}
      {slug === "edit-pdf" && (
        <Field label="What to add">
          <select
            value={o.shape}
            onChange={(e) =>
              set({ shape: e.target.value as DocumentOptions["shape"] })
            }
          >
            <option value="text">Text</option>
            <option value="rectangle">Rectangle</option>
            <option value="highlight">Highlight</option>
            <option value="image">Uploaded image overlay</option>
          </select>
        </Field>
      )}
      {(["watermark-pdf", "page-numbers"].includes(slug) ||
        (slug === "edit-pdf" && o.shape === "text")) && (
        <>
          {slug !== "page-numbers" && (
            <Field
              label={
                slug === "watermark-pdf" ? "Watermark text" : "Text to add"
              }
              hint={
                slug === "watermark-pdf"
                  ? "Or add a watermark image to the file queue."
                  : ""
              }
            >
              <textarea
                aria-label="Text to add"
                rows={3}
                value={o.text}
                maxLength={5000}
                onChange={(e) => set({ text: e.target.value })}
              />
            </Field>
          )}
          <div className="field-grid two">
            <Field label="Font size">
              <input
                type="number"
                min="6"
                max="120"
                value={o.fontSize}
                onChange={(e) => set({ fontSize: +e.target.value })}
              />
            </Field>
            <Field label="Text color">
              <input
                type="color"
                value={o.color}
                onChange={(e) => set({ color: e.target.value })}
              />
            </Field>
          </div>
        </>
      )}
      {slug === "page-numbers" && (
        <>
          <Field label="Starting number">
            <input
              type="number"
              min="0"
              value={o.startNumber}
              onChange={(e) => set({ startNumber: +e.target.value })}
            />
          </Field>
          <Field label="Position">
            <select
              value={o.position}
              onChange={(e) =>
                set({ position: e.target.value as DocumentOptions["position"] })
              }
            >
              {[
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-center",
                "bottom-right",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
        </>
      )}
      {["watermark-pdf", "edit-pdf"].includes(slug) && (
        <Field label={`Opacity · ${Math.round(o.opacity * 100)}%`}>
          <input
            type="range"
            min=".05"
            max="1"
            step=".05"
            value={o.opacity}
            onChange={(e) => set({ opacity: +e.target.value })}
          />
        </Field>
      )}
      {slug === "redact-pdf" && (
        <Field
          label="Search and permanently remove text"
          hint="Leave empty to redact the selected rectangle. Text search needs selectable text or OCR."
        >
          <input
            aria-label="Text to redact"
            value={o.search}
            maxLength={500}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Exact text to remove"
          />
        </Field>
      )}
      {visualTools.includes(slug) && (
        <div className="rectangle-settings">
          <div className="settings-subtitle">
            {slug === "crop-pdf"
              ? "Keep this area"
              : "Placement / selected area"}
            <span>Drag on the page preview</span>
          </div>
          <div className="field-grid two">
            {(["x", "y", "width", "height"] as const).map((key) => (
              <Field
                key={key}
                label={`${key[0].toUpperCase() + key.slice(1)} (%)`}
              >
                <input
                  aria-label={`Rectangle ${key}`}
                  type="number"
                  min={key === "width" || key === "height" ? 1 : 0}
                  max="100"
                  step=".1"
                  value={Math.round(o.rect[key] * 10) / 10}
                  onChange={(e) =>
                    set({ rect: { ...o.rect, [key]: +e.target.value } })
                  }
                />
              </Field>
            ))}
          </div>
        </div>
      )}
      {slug === "pdf-forms" && (
        <>
          <div className="settings-subtitle">Existing form fields</div>
          {meta?.fields.length ? (
            meta.fields.map((field) => (
              <Field
                key={`${field.page}-${field.name}`}
                label={`${field.name} · page ${field.page}`}
              >
                {/check/i.test(field.type) ? (
                  <input
                    type="checkbox"
                    checked={
                      o.values[field.name] === true ||
                      (o.values[field.name] === undefined &&
                        field.value !== "Off" &&
                        !!field.value)
                    }
                    onChange={(e) =>
                      set({
                        values: { ...o.values, [field.name]: e.target.checked },
                      })
                    }
                  />
                ) : (
                  <input
                    aria-label={`Form field ${field.name}`}
                    value={String(o.values[field.name] ?? field.value)}
                    onChange={(e) =>
                      set({
                        values: { ...o.values, [field.name]: e.target.value },
                      })
                    }
                  />
                )}
              </Field>
            ))
          ) : (
            <p className="settings-help">
              No existing fields found. You can create fields using the selected
              area.
            </p>
          )}
          <div className="settings-subtitle">Create an interactive field</div>
          <Field label="Field name">
            <input
              aria-label="New form field name"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="e.g. applicant_name"
              maxLength={80}
            />
          </Field>
          <div className="field-grid two">
            <Field label="Field type">
              <select
                value={fieldType}
                onChange={(e) =>
                  setFieldType(e.target.value as "text" | "checkbox")
                }
              >
                <option value="text">Text field</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </Field>
            <Field label="Page">
              <input
                aria-label="New form field page"
                type="number"
                min="1"
                max={meta?.pages || 200}
                id="new-field-page"
                defaultValue="1"
              />
            </Field>
          </div>
          <button
            className="btn secondary small"
            disabled={
              !fieldName.trim() ||
              o.fields.some((f) => f.name === fieldName.trim())
            }
            onClick={() => {
              const element = document.getElementById(
                "new-field-page",
              ) as HTMLInputElement | null;
              set({
                fields: [
                  ...o.fields,
                  {
                    name: fieldName.trim(),
                    type: fieldType,
                    page: Number(element?.value || 1),
                    rect: { ...o.rect },
                    value: "",
                  },
                ],
              });
              setFieldName("");
            }}
          >
            <Plus size={14} />
            Add field at selected area
          </button>
          {o.fields.map((field, index) => (
            <div className="new-field-row" key={field.name}>
              <span>
                {field.name} · {field.type} · p{field.page}
              </span>
              <button
                aria-label={`Remove field ${field.name}`}
                onClick={() =>
                  set({ fields: o.fields.filter((_, i) => i !== index) })
                }
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <Switch
            label="Flatten filled form into static page content"
            checked={o.flatten}
            onChange={(v) => set({ flatten: v })}
          />
        </>
      )}
      {slug === "protect-pdf" && (
        <Field
          label="New PDF password"
          hint="At least 6 characters; maximum 40 UTF-8 bytes. Save it somewhere safe."
        >
          <input
            aria-label="New PDF password"
            type="password"
            autoComplete="new-password"
            value={o.newPassword}
            maxLength={40}
            onChange={(e) => set({ newPassword: e.target.value })}
          />
        </Field>
      )}
      {slug === "html-to-pdf" && (
        <Field
          label="HTML document"
          hint="HTML is rendered locally. Scripts, remote URLs and external resources are not loaded."
        >
          <textarea
            aria-label="HTML source"
            rows={12}
            value={o.html}
            maxLength={200000}
            onChange={(e) => set({ html: e.target.value })}
            placeholder="<h1>My document</h1><p>Hello from ACE Studio.</p>"
            spellCheck={false}
          />
        </Field>
      )}
      {slug === "translate-pdf" && (
        <Field label="Translate into">
          <select
            value={o.targetLanguage}
            onChange={(e) => set({ targetLanguage: e.target.value })}
          >
            {[
              "English",
              "Urdu",
              "German",
              "Arabic",
              "French",
              "Spanish",
              "Hindi",
              "Italian",
              "Portuguese",
              "Chinese",
              "Japanese",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      )}
      {slug === "ai-summarizer" && (
        <Field label="Summary engine">
          <select
            value={o.aiMode}
            onChange={(e) =>
              set({ aiMode: e.target.value as DocumentOptions["aiMode"] })
            }
          >
            <option value="auto">Gemini when connected and allowed</option>
            <option value="local">Local extractive summary</option>
          </select>
        </Field>
      )}
      {["ai-summarizer", "translate-pdf"].includes(slug) && (
        <div className="ai-consent">
          <ShieldCheck size={17} />
          <div>
            <Switch
              label="Allow extracted document text to be sent to Gemini for this request"
              checked={o.allowAI}
              onChange={(v) => set({ allowAI: v })}
            />
            <p>
              Uploads stay local. This option shares extracted text with
              Google's AI service. It may use your API quota.
            </p>
          </div>
        </div>
      )}
      {[
        "compress-pdf",
        "images-to-pdf",
        "scan-to-pdf",
        "pdf-to-images",
      ].includes(slug) && (
        <Field label={`Image quality · ${o.quality}%`}>
          <input
            type="range"
            min="20"
            max="100"
            value={o.quality}
            onChange={(e) => set({ quality: +e.target.value })}
          />
        </Field>
      )}
      {meta?.kind === "pdf" && (
        <details className="pdf-password">
          <summary>
            <LockKeyhole size={13} />
            Password for the input PDF
          </summary>
          <input
            aria-label="Input PDF password"
            type="password"
            autoComplete="off"
            placeholder="Only if the PDF is protected"
            value={o.password}
            onChange={(e) => set({ password: e.target.value })}
          />
          <p>Passwords are sent only to your local document engine.</p>
        </details>
      )}
    </fieldset>
  );
}
