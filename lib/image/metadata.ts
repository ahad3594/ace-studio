import sharp from "sharp";
import { limits } from "../config.ts";
export function signature(buffer: Buffer) {
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return "jpeg";
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    const brands = buffer.toString("ascii", 8, Math.min(buffer.length, 64));
    if (/avif|avis/.test(brands)) return "avif";
    if (/heic|heix|hevc|hevx|mif1|msf1/.test(brands)) return "heif";
  }
  throw new Error(
    "Unsupported file contents. Upload a JPEG, PNG, WebP, AVIF, or supported HEIC image.",
  );
}
export function inputPipeline(buffer: Buffer) {
  return sharp(buffer, {
    limitInputPixels: limits.inputPixels,
    failOn: "warning",
    sequentialRead: true,
  });
}
export async function inspectImage(buffer: Buffer) {
  if (!buffer.length || buffer.length > limits.maxBytes)
    throw new Error(`Image must be below ${limits.maxBytes / 1024 / 1024} MB.`);
  const detected = signature(buffer);
  let meta;
  try {
    meta = await inputPipeline(buffer).metadata();
  } catch {
    throw new Error(
      "Cannot decode this image. It may be damaged, too large, or require HEIC support on this server.",
    );
  }
  if (!meta.width || !meta.height)
    throw new Error("Image dimensions could not be read.");
  if ((meta.pages ?? 1) > 1)
    throw new Error(
      "Animated or multi-page images are not supported. Export a still image first.",
    );
  const swap = (meta.orientation ?? 1) >= 5;
  return {
    width: swap ? meta.height : meta.width,
    height: swap ? meta.width : meta.height,
    format: detected,
    bytes: buffer.length,
    hasAlpha: meta.hasAlpha,
    density: meta.density ?? null,
  };
}
