"use client";
import { useStudio } from "@/store/studio";
import type { Plan } from "@/lib/plan";
import { Field, Switch } from "./ui";
export function PlanEditor() {
  const p = useStudio((s) => s.plan),
    setPlan = useStudio((s) => s.setPlan);
  const update = (patch: Partial<Plan>) => setPlan({ ...p, ...patch });
  return (
    <div className="plan-editor">
      <Field label="Dimension preset">
        <select
          aria-label="Dimension preset"
          value={
            p.unit === "px" &&
            [
              "1080x1080",
              "1080x1920",
              "1200x628",
              "1920x1080",
              "800x800",
              "600x600",
            ].includes(`${p.width}x${p.height}`)
              ? `${p.width}x${p.height}`
              : ""
          }
          onChange={(e) => {
            if (!e.target.value) return;
            const [width, height] = e.target.value.split("x").map(Number);
            update({
              width,
              height,
              unit: "px",
              scalePercent: null,
              aspectRatio: null,
            });
          }}
        >
          <option value="">Custom / original dimensions</option>
          {[
            "1080x1080",
            "1080x1920",
            "1200x628",
            "1920x1080",
            "800x800",
            "600x600",
          ].map((value) => (
            <option value={value} key={value}>
              {value.replace("x", " × ")} px
            </option>
          ))}
        </select>
      </Field>
      <div className="field-grid">
        <Field label="Width">
          <input
            aria-label="Output width"
            type="number"
            min="1"
            max="12000"
            placeholder="Auto"
            value={p.width ?? ""}
            onChange={(e) =>
              update({
                width: e.target.value ? +e.target.value : null,
                scalePercent: null,
                aspectRatio: null,
              })
            }
          />
        </Field>
        <Field label="Height">
          <input
            aria-label="Output height"
            type="number"
            min="1"
            max="12000"
            placeholder="Auto"
            value={p.height ?? ""}
            onChange={(e) =>
              update({
                height: e.target.value ? +e.target.value : null,
                scalePercent: null,
                aspectRatio: null,
              })
            }
          />
        </Field>
        <Field label="Unit">
          <select
            value={p.unit}
            onChange={(e) => update({ unit: e.target.value as Plan["unit"] })}
          >
            {["px", "mm", "cm", "in"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="field-grid two">
        <Field label="Output format">
          <select
            value={p.format}
            onChange={(e) =>
              update({ format: e.target.value as Plan["format"] })
            }
          >
            <option value="original">Original</option>
            {["jpeg", "png", "webp", "avif"].map((f) => (
              <option value={f} key={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Maximum size (KB)">
          <input
            aria-label="Maximum file size in KB"
            type="number"
            min="1"
            max="20480"
            placeholder="No limit"
            value={p.targetFileSizeKB ?? ""}
            onChange={(e) =>
              update({
                targetFileSizeKB: e.target.value ? +e.target.value : null,
                sizeMode: "maximum",
                compression: !!e.target.value,
              })
            }
          />
        </Field>
      </div>
      <Field label="Resize method">
        <select
          value={p.resizeMode}
          onChange={(e) =>
            update({
              resizeMode: e.target.value as Plan["resizeMode"],
              preserveAspectRatio: e.target.value !== "fill",
            })
          }
        >
          <option value="contain">
            Fit with padding — preserve full image
          </option>
          <option value="inside">Fit within bounds — no padding</option>
          <option value="cover">Crop to fill — removes image edges</option>
          <option value="fill">Stretch — changes proportions</option>
        </select>
      </Field>
      {p.resizeMode === "cover" && (
        <p className="inline-warning">
          Cropping removes image edges. Check the preview before downloading.
        </p>
      )}
      <div className="field-grid two">
        <Field label="Aspect ratio">
          <select
            value={p.aspectRatio ?? ""}
            onChange={(e) =>
              update({
                aspectRatio: e.target.value || null,
                width: null,
                height: null,
                scalePercent: null,
              })
            }
          >
            <option value="">Original / dimensions</option>
            {["1:1", "4:3", "3:4", "16:9", "9:16"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Crop / pad position">
          <select
            value={p.position}
            onChange={(e) =>
              update({ position: e.target.value as Plan["position"] })
            }
          >
            {[
              "centre",
              "north",
              "south",
              "east",
              "west",
              "northwest",
              "northeast",
              "southwest",
              "southeast",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
      </div>
      <details className="advanced">
        <summary>Quality, DPI & advanced controls</summary>
        <div className="advanced-body">
          <Field label="Compression mode">
            <select
              value={p.qualityPreference}
              onChange={(e) => {
                const qualityPreference = e.target
                  .value as Plan["qualityPreference"];
                const quality =
                  qualityPreference === "high"
                    ? 95
                    : qualityPreference === "balanced"
                      ? 82
                      : qualityPreference === "small"
                        ? 65
                        : p.quality;
                const minQuality =
                  qualityPreference === "high"
                    ? 60
                    : qualityPreference === "balanced"
                      ? 20
                      : qualityPreference === "small"
                        ? 5
                        : Math.min(p.minQuality, quality);
                update({
                  qualityPreference,
                  quality,
                  minQuality,
                  compression: true,
                });
              }}
            >
              <option value="high">Maximum quality</option>
              <option value="balanced">Balanced</option>
              <option value="small">Maximum compression</option>
              <option value="custom">Custom</option>
            </select>
          </Field>
          <Field label={`Quality · ${p.quality}%`}>
            <input
              type="range"
              min="1"
              max="100"
              value={p.quality}
              onChange={(e) =>
                update({
                  quality: +e.target.value,
                  minQuality: Math.min(p.minQuality, +e.target.value),
                  qualityPreference: "custom",
                })
              }
            />
          </Field>
          <div className="field-grid two">
            <Field label="Minimum quality">
              <input
                type="number"
                min="1"
                max={p.quality}
                value={p.minQuality}
                onChange={(e) => update({ minQuality: +e.target.value })}
              />
            </Field>
            <Field label="Scale (%)">
              <input
                type="number"
                min="1"
                max="400"
                placeholder="100"
                value={p.scalePercent ?? ""}
                onChange={(e) =>
                  update({
                    scalePercent: e.target.value ? +e.target.value : null,
                    width: null,
                    height: null,
                    aspectRatio: null,
                  })
                }
              />
            </Field>
          </div>
          <div className="field-grid two">
            <Field label="DPI / PPI">
              <input
                type="number"
                min="10"
                max="1200"
                placeholder="Unchanged"
                value={p.dpi ?? ""}
                onChange={(e) =>
                  update({ dpi: e.target.value ? +e.target.value : null })
                }
              />
            </Field>
            <Field label="Background">
              <input
                type="color"
                value={p.background}
                onChange={(e) => update({ background: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Custom aspect ratio">
            <input
              placeholder="e.g. 5:4"
              defaultValue={p.aspectRatio ?? ""}
              onBlur={(e) => {
                if (/^\d{1,3}:\d{1,3}$/.test(e.target.value))
                  update({
                    aspectRatio: e.target.value,
                    width: null,
                    height: null,
                    scalePercent: null,
                  });
              }}
            />
          </Field>
          <Switch
            label="Allow upscaling"
            checked={p.allowUpscaling}
            onChange={(v) => update({ allowUpscaling: v })}
          />
          <Switch
            label="Allow smaller dimensions to reach size limit"
            checked={p.allowDimensionReduction}
            onChange={(v) => update({ allowDimensionReduction: v })}
          />
          <Switch
            label="Preserve transparency"
            checked={p.preserveTransparency}
            onChange={(v) => update({ preserveTransparency: v })}
          />
          <Switch
            label="Retain metadata (may include GPS)"
            checked={p.retainMetadata}
            onChange={(v) => update({ retainMetadata: v })}
          />
        </div>
      </details>
    </div>
  );
}
