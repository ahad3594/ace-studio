import { defaultPlan, pixelValue } from "./plan";
import type { Plan } from "./plan";
import { safeFilename, uniqueFilename } from "./batch";
export interface ImageMeta {
  width: number;
  height: number;
  bytes: number;
  format: string;
  hasAlpha?: boolean;
  density?: number | null;
}
export interface Result extends ImageMeta {
  mime: string;
  originalBytes: number;
  quality: number | null;
  targetMet: boolean;
  targetBytes: number | null;
  warnings: string[];
  reduction: number;
  blob: Blob;
  url: string;
  filename: string;
  plan: Plan;
  engine: "server" | "browser";
}
export interface ImageItem {
  id: string;
  file: File;
  url: string;
  meta: ImageMeta;
  status: "ready" | "processing" | "done" | "error";
  error?: string;
  result?: Result;
}
export const bytesLabel = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;
export async function browserMetadata(
  file: File,
  maxPixels = 40_000_000,
): Promise<ImageMeta> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const ascii = new TextDecoder().decode(head);
  let format =
    head[0] === 255 && head[1] === 216
      ? "jpeg"
      : head[0] === 137 && ascii.slice(1, 4) === "PNG"
        ? "png"
        : ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP"
          ? "webp"
          : ascii.slice(4, 8) === "ftyp" && /avif|heic|heif|mif1/.test(ascii)
            ? /avif/.test(ascii)
              ? "avif"
              : "heif"
            : "";
  if (!format)
    throw new Error(
      "Unsupported image contents. Use JPEG, PNG, WebP, AVIF, or supported HEIC.",
    );
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(
      "Your browser cannot decode this image. Connect to the server or try JPEG/PNG.",
    );
  });
  try {
    if (bitmap.width * bitmap.height > maxPixels)
      throw new Error("This image exceeds the safe pixel limit.");
    return {
      width: bitmap.width,
      height: bitmap.height,
      bytes: file.size,
      format,
    };
  } finally {
    bitmap.close();
  }
}
export async function processInBrowser(
  file: File,
  p: Plan,
): Promise<Omit<Result, "url" | "filename" | "plan">> {
  const meta = await browserMetadata(file);
  if (p.sizeMode === "exact" && p.targetFileSizeKB)
    throw new Error(
      "Exact byte sizes cannot be guaranteed. Choose a maximum size.",
    );
  if (p.dpi || p.retainMetadata)
    throw new Error(
      "DPI and metadata controls require the local image server. Reconnect or clear these settings.",
    );
  const format = p.format === "original" ? meta.format : p.format;
  if (!["jpeg", "png", "webp"].includes(format))
    throw new Error(
      "This format requires the image server. Choose JPEG, PNG, or WebP for browser processing.",
    );
  let w = p.width ? pixelValue(p.width, p.unit, p.dpi) : null,
    h = p.height ? pixelValue(p.height, p.unit, p.dpi) : null;
  if (p.scalePercent) {
    w = Math.round((meta.width * p.scalePercent) / 100);
    h = Math.round((meta.height * p.scalePercent) / 100);
  }
  if (p.aspectRatio && !w && !h) {
    const [a, b] = p.aspectRatio.split(":").map(Number);
    w = meta.width;
    h = Math.round((w * b) / a);
    if (p.resizeMode === "cover" && h > meta.height) {
      h = meta.height;
      w = Math.round((h * a) / b);
    }
  }
  w ??= h ? Math.round((meta.width * h) / meta.height) : meta.width;
  h ??= Math.round((meta.height * w) / meta.width);
  if (w < 1 || h < 1 || w > 12000 || h > 12000 || w * h > 24_000_000)
    throw new Error("Choose output dimensions below the safe pixel limit.");
  if (p.resizeMode === "fill" && p.preserveAspectRatio)
    throw new Error("Disable aspect-ratio preservation to stretch.");
  let scale =
    p.resizeMode === "cover"
      ? Math.max(w / meta.width, h / meta.height)
      : Math.min(w / meta.width, h / meta.height);
  if (!p.allowUpscaling && scale > 1 && p.resizeMode === "cover")
    throw new Error(
      "This crop requires upscaling. Enable it or choose smaller dimensions.",
    );
  if (!p.allowUpscaling) scale = Math.min(1, scale);
  if (
    p.resizeMode === "fill" &&
    !p.allowUpscaling &&
    (w > meta.width || h > meta.height)
  )
    throw new Error("Stretching requires upscaling permission.");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  let quality = p.quality,
    factor = 1;
  const target = p.targetFileSizeKB
    ? Math.floor(p.targetFileSizeKB * 1024)
    : null;
  const encode = async (q: number) => {
    canvas.width = Math.max(
      1,
      Math.floor(
        (p.resizeMode === "inside" ? meta.width * scale : w!) * factor,
      ),
    );
    canvas.height = Math.max(
      1,
      Math.floor(
        (p.resizeMode === "inside" ? meta.height * scale : h!) * factor,
      ),
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image canvas is unavailable.");
    if (format === "jpeg" || !p.preserveTransparency) {
      ctx.fillStyle = p.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (p.resizeMode === "contain") {
      ctx.fillStyle = p.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingQuality = "high";
    const dw =
        p.resizeMode === "fill" ? canvas.width : meta.width * scale * factor,
      dh =
        p.resizeMode === "fill" ? canvas.height : meta.height * scale * factor;
    const dx = canvas.width - dw,
      dy = canvas.height - dh;
    ctx.drawImage(
      bitmap,
      p.position.includes("west")
        ? 0
        : p.position.includes("east")
          ? dx
          : dx / 2,
      p.position.includes("north")
        ? 0
        : p.position.includes("south")
          ? dy
          : dy / 2,
      dw,
      dh,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(new Error("Your browser could not encode this image.")),
        `image/${format}`,
        q / 100,
      ),
    );
    if (blob.type !== `image/${format}`)
      throw new Error("This output format is unavailable in your browser.");
    return blob;
  };
  try {
    let blob = await encode(quality);
    if (target && blob.size > target && format !== "png") {
      let low = p.minQuality,
        high = p.quality - 1,
        best: Blob | null = null,
        bestQ = low;
      while (low <= high) {
        const q = Math.floor((low + high) / 2),
          b = await encode(q);
        if (b.size <= target) {
          best = b;
          bestQ = q;
          low = q + 1;
        } else high = q - 1;
      }
      quality = best ? bestQ : p.minQuality;
      blob = best ?? (await encode(quality));
    }
    if (
      target &&
      blob.size > target &&
      p.allowDimensionReduction &&
      format !== "png"
    )
      for (let i = 0; i < 8 && blob.size > target; i++) {
        factor *= Math.min(0.85, Math.sqrt(target / blob.size) * 0.9);
        blob = await encode(quality);
      }
    const targetMet = !target || blob.size <= target;
    const warnings = targetMet
      ? []
      : [
          format === "png"
            ? "Lossless PNG exceeds the target. Choose JPEG or WebP to permit lossy compression."
            : "The output exceeds the target. Allow smaller dimensions or a lower minimum quality.",
        ];
    if (factor < 1)
      warnings.push("Dimensions were reduced with your permission.");
    return {
      blob,
      bytes: blob.size,
      originalBytes: file.size,
      format,
      mime: blob.type,
      width: canvas.width,
      height: canvas.height,
      quality: format === "png" ? null : quality,
      targetMet,
      targetBytes: target,
      warnings,
      reduction: Math.round((1 - blob.size / file.size) * 1000) / 10,
      engine: "browser",
    };
  } finally {
    bitmap.close();
    canvas.width = canvas.height = 1;
  }
}
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function outputName(
  item: ImageItem,
  result: { format: string },
  index: number,
  pattern: string,
  used: Set<string>,
) {
  return uniqueFilename(
    safeFilename(item.file.name, result.format, index, pattern),
    used,
  );
}
export { defaultPlan };
