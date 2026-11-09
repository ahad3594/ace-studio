import { z } from "zod";
import { defaultPlan } from "./plan.ts";
export const planObject = z
  .object({
    width: z.number().positive().max(12000).nullable(),
    height: z.number().positive().max(12000).nullable(),
    unit: z.enum(["px", "mm", "cm", "in"]),
    dpi: z.number().int().min(10).max(1200).nullable(),
    scalePercent: z.number().min(1).max(400).nullable(),
    aspectRatio: z
      .string()
      .regex(/^\d{1,3}:\d{1,3}$/)
      .refine(
        (v) => v.split(":").every((n) => +n > 0),
        "Ratio values must be positive",
      )
      .nullable(),
    format: z.enum(["original", "jpeg", "png", "webp", "avif"]),
    targetFileSizeKB: z.number().min(1).max(20480).nullable(),
    sizeMode: z.enum(["maximum", "exact"]),
    quality: z.number().int().min(1).max(100),
    minQuality: z.number().int().min(1).max(100),
    qualityPreference: z.enum(["high", "balanced", "small", "custom"]),
    resizeMode: z.enum(["contain", "cover", "fill", "inside"]),
    position: z.enum([
      "centre",
      "north",
      "south",
      "east",
      "west",
      "northeast",
      "northwest",
      "southeast",
      "southwest",
    ]),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    preserveAspectRatio: z.boolean(),
    allowUpscaling: z.boolean(),
    allowDimensionReduction: z.boolean(),
    preserveTransparency: z.boolean(),
    retainMetadata: z.boolean(),
    compression: z.boolean(),
  })
  .strict();
export const planSchema = planObject.superRefine((p, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (p.minQuality > p.quality)
    issue("Minimum quality cannot exceed starting quality.");
  if (p.unit !== "px" && (p.width || p.height) && !p.dpi)
    issue("Physical dimensions require an explicit DPI.");
  if (p.scalePercent && (p.width || p.height))
    issue("Choose percentage scaling or dimensions, not both.");
  if (p.resizeMode === "fill" && p.preserveAspectRatio)
    issue("Stretch requires disabling aspect-ratio preservation.");
});
export const aiRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(2000),
    currentPlan: planObject.default(defaultPlan),
    imageMetadata: z.array(z.object({width:z.number().int().positive().max(40000000),height:z.number().int().positive().max(40000000),bytes:z.number().int().nonnegative().max(20971520),format:z.string().max(15)}).strict()).max(20).default([]),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          text: z.string().max(2000),
        }),
      )
      .max(8)
      .default([]),
  })
  .strict();
export const interpretationSchema = z
  .object({
    plan: planObject,
    questions: z.array(z.string().max(300)).max(3),
    message: z.string().max(600),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (!result.questions.length) {
      const valid = planSchema.safeParse(result.plan);
      if (!valid.success)
        for (const issue of valid.error.issues)
          ctx.addIssue({ code: "custom", message: issue.message });
    }
  });
