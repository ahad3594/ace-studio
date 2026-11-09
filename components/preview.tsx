"use client";
import { useState } from "react";
import {
  ImageIcon,
  MoveHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize2,
  SlidersHorizontal,
  Columns2,
  Check,
  Download,
  Loader2,
  Mountain,
  ArrowUpRight,
} from "lucide-react";
import type { ImageItem } from "@/lib/client";
import { bytesLabel } from "@/lib/client";
import { useStudio } from "@/store/studio";
export function Preview({
  item,
  onSample,
  onDownload,
  busy,
}: {
  item?: ImageItem;
  onSample: () => void;
  onDownload: () => void;
  busy: boolean;
}) {
  const [view, setView] = useState<"compare" | "split">("compare"),
    [slider, setSlider] = useState(50),
    [zoom, setZoom] = useState(1);
  const r = item?.result;
  const plan = useStudio((s) => s.plan),
    changed = !!r && JSON.stringify(r.plan) !== JSON.stringify(plan);
  return (
    <section className="preview-panel panel" aria-label="Image preview">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">THE CANVAS</span>
          <h2>
            {item
              ? "Your image, refined."
              : "A little input. A big difference."}
          </h2>
        </div>
        <div className="segmented">
          <button
            aria-label="Slider comparison"
            aria-pressed={view === "compare"}
            onClick={() => setView("compare")}
            className={view === "compare" ? "selected" : ""}
          >
            <SlidersHorizontal size={15} />
          </button>
          <button
            aria-label="Side by side comparison"
            aria-pressed={view === "split"}
            onClick={() => setView("split")}
            className={view === "split" ? "selected" : ""}
          >
            <Columns2 size={15} />
          </button>
        </div>
      </div>
      {changed && (
        <p className="preview-changed">
          Settings changed. Generate again to update this result.
        </p>
      )}
      <div className={`canvas checker ${item ? "has-image" : ""}`}>
        {!item ? (
          <div className="empty-canvas">
            <div className="demo-art">
              <div className="demo-sun" />
              <div className="demo-mountain back" />
              <div className="demo-mountain front" />
              <div className="demo-label">
                <Mountain size={15} /> Endless possibilities.
              </div>
              <div className="floating-spark">✦</div>
            </div>
            <h3>Your next great image starts here.</h3>
            <p>Drop a photo to make room for possibility.</p>
            <button className="text-button" onClick={onSample}>
              Try a sample image <ArrowUpRight size={14} />
            </button>
          </div>
        ) : view === "split" && r ? (
          <div className="split-view">
            <figure>
              <img
                src={item.url}
                alt="Original uploaded image"
                style={{ transform: `scale(${zoom})` }}
              />
              <figcaption>Original</figcaption>
            </figure>
            <figure>
              <img
                src={r.url}
                alt="Actual processed image"
                style={{ transform: `scale(${zoom})` }}
              />
              <figcaption>Processed</figcaption>
            </figure>
          </div>
        ) : (
          <div className="comparison" style={{ transform: `scale(${zoom})` }}>
            <img
              src={r?.url ?? item.url}
              alt={r ? "Processed image" : "Original uploaded image"}
              className="compare-image"
            />
            {r && (
              <>
                <div
                  className="original-overlay"
                  style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
                >
                  <img
                    src={item.url}
                    alt="Original for comparison"
                    className="compare-image"
                  />
                </div>
                <div className="compare-line" style={{ left: `${slider}%` }}>
                  <span>
                    <MoveHorizontal size={18} />
                  </span>
                </div>
                <input
                  aria-label="Before and after comparison position"
                  className="compare-range"
                  type="range"
                  min="0"
                  max="100"
                  value={slider}
                  onChange={(e) => setSlider(+e.target.value)}
                />
                <div className="preview-tag before">Original</div>
                <div className="preview-tag after">Processed</div>
              </>
            )}
          </div>
        )}
        {busy && item?.status === "processing" && (
          <div className="processing-overlay">
            <Loader2 className="spin" size={26} />
            <strong>Forging your image…</strong>
            <span>Encoding and checking the actual bytes.</span>
          </div>
        )}
        {item && (
          <div className="canvas-tools">
            <button
              aria-label="Zoom out"
              disabled={zoom <= 0.5}
              onClick={() => setZoom((v) => Math.max(0.5, v - 0.25))}
            >
              <ZoomOut size={15} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              aria-label="Zoom in"
              disabled={zoom >= 3}
              onClick={() => setZoom((v) => Math.min(3, v + 0.25))}
            >
              <ZoomIn size={15} />
            </button>
            <i />
            <button aria-label="Fit image to screen" onClick={() => setZoom(1)}>
              <Maximize2 size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="canvas-bottom">
        <span>
          <ImageIcon size={13} />
          {item
            ? `${item.meta.width} × ${item.meta.height} px`
            : "Your image. Only better."}
        </span>
        <span>
          {item
            ? `${item.meta.format.toUpperCase()} · ${bytesLabel(item.meta.bytes)}`
            : "Full fidelity. Zero guesswork."}
        </span>
      </div>
      {r ? (
        <div className={`result-card ${r.targetMet ? "" : "unmet"}`}>
          <div className="result-title">
            <span className="status-icon">
              <Check size={16} />
            </span>
            <div>
              <h3>
                {r.targetMet
                  ? "Your image is ready."
                  : "Processed · size limit not met"}
              </h3>
              <p>
                {r.width} × {r.height} px <span>·</span>{" "}
                {r.format.toUpperCase()} <span>·</span>{" "}
                {r.engine === "server" ? "Sharp engine" : "Browser engine"}
                {r.quality !== null ? ` · Quality ${r.quality}%` : ""}
              </p>
            </div>
            <button
              className="icon-btn download-result"
              aria-label="Download processed image"
              onClick={onDownload}
            >
              <Download size={17} />
            </button>
          </div>
          <div className="result-stats">
            <div>
              <span>Original</span>
              <strong>{bytesLabel(r.originalBytes)}</strong>
            </div>
            <div>
              <span>Optimized</span>
              <strong className="accent-green">{bytesLabel(r.bytes)}</strong>
            </div>
            <div>
              <span>
                {r.reduction >= 0 ? "Size reduced" : "Size increased"}
              </span>
              <strong>{Math.abs(r.reduction)}%</strong>
            </div>
          </div>
          {r.warnings.map((w) => (
            <p className="inline-warning" key={w}>
              {w}
            </p>
          ))}
        </div>
      ) : (
        <div className="preview-help">
          <div className="help-icon">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <strong>Precision meets simplicity.</strong>
            <p>Describe the result. Review the plan. We handle the pixels.</p>
          </div>
          <span className="tiny-badge">NO GUESSWORK</span>
        </div>
      )}
    </section>
  );
}
