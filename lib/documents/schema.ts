import { z } from "zod";
export const rectSchema = z
  .object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().positive().max(100),
    height: z.number().positive().max(100),
  })
  .strict()
  .refine(
    (r) => r.x + r.width <= 100.01 && r.y + r.height <= 100.01,
    "Rectangle must stay inside the page.",
  );
const fieldSchema = z
  .object({
    name: z.string().min(1).max(80),
    type: z.enum(["text", "checkbox"]),
    page: z.number().int().min(1).max(300),
    rect: rectSchema,
    value: z.string().max(1000).default(""),
  })
  .strict();
export const documentOptionsSchema = z
  .object({
    pages: z.string().max(2000).default("all"),
    groups: z.string().max(4000).default(""),
    password: z.string().max(256).default(""),
    newPassword: z.string().max(256).default(""),
    rotation: z
      .union([z.literal(90), z.literal(180), z.literal(270)])
      .default(90),
    dpi: z.number().int().min(72).max(300).default(144),
    quality: z.number().int().min(20).max(100).default(85),
    format: z.enum(["jpeg", "png"]).default("jpeg"),
    extractImages: z.boolean().default(false),
    paper: z.enum(["a4", "letter", "original"]).default("a4"),
    orientation: z.enum(["portrait", "landscape"]).default("portrait"),
    margin: z.number().min(0).max(100).default(24),
    compression: z.enum(["lossless", "balanced", "strong"]).default("lossless"),
    targetKB: z.number().positive().max(102400).nullable().default(null),
    text: z.string().max(5000).default(""),
    fontSize: z.number().min(6).max(120).default(18),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .default("#5B49C8"),
    opacity: z.number().min(0.05).max(1).default(0.35),
    position: z
      .enum([
        "top-left",
        "top-right",
        "center",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ])
      .default("bottom-center"),
    startNumber: z.number().int().min(0).max(100000).default(1),
    rect: rectSchema.default({ x: 10, y: 10, width: 80, height: 80 }),
    shape: z.enum(["text", "rectangle", "highlight", "image"]).default("text"),
    search: z.string().max(500).default(""),
    caseSensitive: z.boolean().default(false),
    fields: z.array(fieldSchema).max(100).default([]),
    values: z
      .record(
        z.string().max(100),
        z.union([z.string().max(10000), z.boolean()]),
      )
      .default({}),
    flatten: z.boolean().default(false),
    language: z.enum(["eng", "deu", "urd", "eng+urd"]).default("eng"),
    ocr: z.boolean().default(false),
    slideMode: z.enum(["editable", "visual"]).default("editable"),
    html: z.string().max(200000).default(""),
    targetLanguage: z.string().min(1).max(80).default("English"),
    allowAI: z.boolean().default(false),
    aiMode: z.enum(["auto", "local"]).default("auto"),
  })
  .strict();
export type DocumentOptions = z.infer<typeof documentOptionsSchema>;
export const defaultDocumentOptions = documentOptionsSchema.parse({});
export const workflowStepSchema = z
  .object({
    tool: z.enum([
      "rotate-pdf",
      "page-numbers",
      "watermark-pdf",
      "crop-pdf",
      "compress-pdf",
      "remove-pages",
      "extract-pages",
      "repair-pdf",
      "protect-pdf",
      "unlock-pdf",
      "redact-pdf",
    ]),
    options: documentOptionsSchema,
  })
  .strict();
export const documentRequestSchema = z
  .object({
    tool: z.string().min(1).max(80),
    options: documentOptionsSchema,
    steps: z.array(workflowStepSchema).max(8).default([]),
  })
  .strict();
