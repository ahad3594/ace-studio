import sharp from "sharp";
import type { Plan } from "../plan.ts";
import { pixelValue } from "../plan.ts";
import { limits } from "../config.ts";
import { inputPipeline, inspectImage } from "./metadata.ts";
sharp.cache({ memory: 32, files: 0, items: 32 });
sharp.concurrency(1);
export const mimeTypes = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};
export type Processed = Awaited<ReturnType<typeof processImage>>;
export async function processImage(input: Buffer, plan: Plan) {
  const original = await inspectImage(input);
  if (plan.sizeMode === "exact" && plan.targetFileSizeKB)
    throw new Error(
      "Exact byte sizes cannot be guaranteed. Choose a maximum file size; no image has been changed.",
    );
  const format =
    plan.format === "original"
      ? original.format === "heif"
        ? "jpeg"
        : original.format
      : plan.format;
  if (!(format in mimeTypes))
    throw new Error("This output format is not supported.");
  const outputFormat = format as keyof typeof mimeTypes;
  let width = plan.width
    ? pixelValue(plan.width, plan.unit, plan.dpi)
    : undefined;
  let height = plan.height
    ? pixelValue(plan.height, plan.unit, plan.dpi)
    : undefined;
  if (plan.scalePercent) {
    width = Math.max(1, Math.round((original.width * plan.scalePercent) / 100));
    height = Math.max(
      1,
      Math.round((original.height * plan.scalePercent) / 100),
    );
  }
  if (plan.aspectRatio && !width && !height) {
    const [a, b] = plan.aspectRatio.split(":").map(Number);
    width = original.width;
    height = Math.max(1, Math.round((width * b) / a));
    if (plan.resizeMode === "cover" && height > original.height) {
      height = original.height;
      width = Math.max(1, Math.round((height * a) / b));
    }
  }
  const ew =
    width ??
    (height
      ? Math.round((original.width * height) / original.height)
      : original.width);
  const eh =
    height ??
    (width
      ? Math.round((original.height * width) / original.width)
      : original.height);
  if (ew * eh > limits.outputPixels || ew > 12000 || eh > 12000)
    throw new Error(
      "Output exceeds the configured pixel limit. Choose smaller dimensions.",
    );
  if (plan.resizeMode === "fill" && plan.preserveAspectRatio)
    throw new Error(
      "Stretching requires explicit permission to change the aspect ratio.",
    );
  const hasBounds = !!(width || height);
  const fit = plan.resizeMode;
  const warnings: string[] = [];
  if (
    fit === "cover" &&
    hasBounds &&
    !plan.allowUpscaling &&
    Math.max((width ?? 0) / original.width, (height ?? 0) / original.height) > 1
  ) {
    throw new Error(
      "This crop needs upscaling. Enable upscaling or choose smaller dimensions.",
    );
  }
  if (
    fit === "fill" &&
    !plan.allowUpscaling &&
    (ew > original.width || eh > original.height)
  )
    throw new Error(
      "Stretching to these dimensions needs upscaling. Enable it explicitly.",
    );
  const target = plan.targetFileSizeKB
    ? Math.floor(plan.targetFileSizeKB * 1024)
    : null;
  async function encode(quality: number, factor = 1): Promise<Buffer> {
    let pipeline = inputPipeline(input).autoOrient();
    let w = width,
      h = height;
    if (factor < 1) {
      w = Math.max(1, Math.floor(ew * factor));
      h = Math.max(1, Math.floor(eh * factor));
    }
    if (w || h) {
      // Resize inside first, then explicitly pad: exact canvas dimensions never
      // imply permission to upscale the image itself.
      if (fit === "contain") {
        w ??= Math.max(1, Math.round((original.width * h!) / original.height));
        h ??= Math.max(1, Math.round((original.height * w) / original.width));
        pipeline = pipeline.resize(w, h, {
          fit: "inside",
          withoutEnlargement: !plan.allowUpscaling,
        });
        if (plan.retainMetadata) pipeline = pipeline.keepMetadata();
        const intermediate = await pipeline
          .png({ compressionLevel: 0 })
          .toBuffer({ resolveWithObject: true });
        const dx = w - intermediate.info.width,
          dy = h - intermediate.info.height;
        const left = plan.position.includes("west")
          ? 0
          : plan.position.includes("east")
            ? dx
            : Math.floor(dx / 2);
        const top = plan.position.includes("north")
          ? 0
          : plan.position.includes("south")
            ? dy
            : Math.floor(dy / 2);
        pipeline = sharp(intermediate.data).extend({
          left,
          right: dx - left,
          top,
          bottom: dy - top,
          background: plan.background,
        });
      } else
        pipeline = pipeline.resize(w, h, {
          fit,
          position: plan.position,
          withoutEnlargement: !plan.allowUpscaling,
          background: plan.background,
        });
    }
    if (outputFormat === "jpeg" || !plan.preserveTransparency)
      pipeline = pipeline.flatten({ background: plan.background });
    if (plan.dpi && !plan.retainMetadata) {
      // Strip all source metadata in a lossless intermediate before adding DPI.
      // withMetadata alone would otherwise retain sensitive source EXIF.
      const clean = await pipeline.png({ compressionLevel: 0 }).toBuffer();
      pipeline = sharp(clean).withMetadata({
        density: plan.dpi,
        orientation: 1,
      });
    } else if (plan.retainMetadata)
      pipeline = pipeline.withMetadata({
        ...(plan.dpi ? { density: plan.dpi } : {}),
        orientation: 1,
      });
    if (outputFormat === "jpeg")
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    if (outputFormat === "webp")
      pipeline = pipeline.webp({ quality, effort: 4 });
    if (outputFormat === "avif")
      pipeline = pipeline.avif({ quality, effort: 3 });
    if (outputFormat === "png")
      pipeline = pipeline.png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: false,
      });
    return pipeline.toBuffer();
  }
  let quality = plan.quality,
    factor = 1;
  let result = await encode(quality);
  if (target && result.length > target && outputFormat !== "png") {
    let best: Buffer | null = null,
      bestQ = plan.minQuality;
    let low = plan.minQuality,
      high = plan.quality - 1;
    // Bounded search; every accepted candidate is measured, never estimated.
    while (low <= high) {
      const q = Math.floor((low + high) / 2),
        candidate = await encode(q);
      if (candidate.length <= target) {
        best = candidate;
        bestQ = q;
        low = q + 1;
      } else high = q - 1;
    }
    if (best) {
      result = best;
      quality = bestQ;
    } else {
      quality = plan.minQuality;
      result = await encode(quality);
    }
  }
  if (
    target &&
    result.length > target &&
    plan.allowDimensionReduction &&
    outputFormat !== "png"
  ) {
    for (let i = 0; i < 8 && result.length > target; i++) {
      factor *= Math.min(0.85, Math.sqrt(target / result.length) * 0.9);
      result = await encode(quality, factor);
    }
    warnings.push(
      "Dimensions were reduced with your permission to approach the file-size limit.",
    );
  }
  const targetMet = !target || result.length <= target;
  if (!targetMet)
    warnings.push(
      outputFormat === "png"
        ? "Lossless PNG could not meet the size limit. Choose JPEG or WebP to allow lossy compression."
        : "The measured output exceeds your size limit. Allow smaller dimensions or a lower minimum quality.",
    );
  if (
    plan.compression &&
    !hasBounds &&
    !plan.aspectRatio &&
    !plan.dpi &&
    !plan.retainMetadata &&
    outputFormat === original.format &&
    result.length >= input.length &&
    (!target || input.length <= target)
  ) {
    // Prefer the smaller original only when no transformation or metadata removal is promised.
    warnings.push(
      "This image is already efficiently encoded; re-encoding did not reduce its size.",
    );
  }
  const meta = await sharp(result).metadata();
  return {
    data: result,
    format: outputFormat,
    mime: mimeTypes[outputFormat],
    width: meta.width!,
    height: meta.height!,
    bytes: result.length,
    originalBytes: input.length,
    quality: outputFormat === "png" ? null : quality,
    targetMet,
    targetBytes: target,
    warnings,
    density: meta.density ?? null,
    reduction: Math.round((1 - result.length / input.length) * 1000) / 10,
  };
}
