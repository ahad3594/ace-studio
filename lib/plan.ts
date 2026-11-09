export type OutputFormat = "original" | "jpeg" | "png" | "webp" | "avif";
export interface Plan {
  width: number | null;
  height: number | null;
  unit: "px" | "mm" | "cm" | "in";
  dpi: number | null;
  scalePercent: number | null;
  aspectRatio: string | null;
  format: OutputFormat;
  targetFileSizeKB: number | null;
  sizeMode: "maximum" | "exact";
  quality: number;
  minQuality: number;
  qualityPreference: "high" | "balanced" | "small" | "custom";
  resizeMode: "contain" | "cover" | "fill" | "inside";
  position:
    | "centre"
    | "north"
    | "south"
    | "east"
    | "west"
    | "northeast"
    | "northwest"
    | "southeast"
    | "southwest";
  background: string;
  preserveAspectRatio: boolean;
  allowUpscaling: boolean;
  allowDimensionReduction: boolean;
  preserveTransparency: boolean;
  retainMetadata: boolean;
  compression: boolean;
}
export const defaultPlan: Plan = {
  width: null,
  height: null,
  unit: "px",
  dpi: null,
  scalePercent: null,
  aspectRatio: null,
  format: "original",
  targetFileSizeKB: null,
  sizeMode: "maximum",
  quality: 88,
  minQuality: 20,
  qualityPreference: "high",
  resizeMode: "contain",
  position: "centre",
  background: "#FFFFFF",
  preserveAspectRatio: true,
  allowUpscaling: false,
  allowDimensionReduction: false,
  preserveTransparency: true,
  retainMetadata: false,
  compression: false,
};
export function pixelValue(
  value: number,
  unit: Plan["unit"],
  dpi: number | null,
) {
  if (unit === "px") return Math.round(value);
  if (!dpi) throw new Error("Please specify DPI for physical dimensions.");
  return Math.max(
    1,
    Math.round(
      (value * dpi) / (unit === "mm" ? 25.4 : unit === "cm" ? 2.54 : 1),
    ),
  );
}
export function planSummary(p: Plan): string[] {
  return [
    `Output: ${p.format === "original" ? "Original format" : p.format.toUpperCase()}`,
    p.scalePercent
      ? `Scale: ${p.scalePercent}%`
      : p.width || p.height
        ? `Dimensions: ${p.width ?? "Auto"} × ${p.height ?? "Auto"} ${p.unit}${p.dpi ? ` · ${p.dpi} DPI` : ""}`
        : p.aspectRatio
          ? `Aspect ratio: ${p.aspectRatio}`
          : "Dimensions: Preserve original",
    p.targetFileSizeKB
      ? `${p.sizeMode === "exact" ? "Requested exact size" : "Maximum size"}: ${p.targetFileSizeKB} KB`
      : `Quality: ${p.quality}%`,
    `Resize: ${p.resizeMode === "contain" ? "Fit with padding · no cropping" : p.resizeMode === "cover" ? "Crop to fill" : p.resizeMode === "fill" ? "Stretch to fit" : "Fit within bounds"}`,
    `Background: ${p.background}${p.preserveTransparency ? " · preserve alpha where supported" : ""}`,
    `Constraints: ${p.allowUpscaling ? "Upscaling allowed" : "No upscaling"} · ${p.allowDimensionReduction ? "Further dimension reduction allowed" : "Keep chosen dimensions"}`,
  ];
}
