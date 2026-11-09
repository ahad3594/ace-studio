"use client";
import { useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
export function SignaturePad({
  onChange,
}: {
  onChange: (blob: Blob | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false),
    [hasInk, setHasInk] = useState(false);
  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = ref.current!,
      rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  };
  return (
    <div className="signature-pad">
      <div>
        <span>
          <PenLine size={14} />
          Draw your signature
        </span>
        <button
          className="text-button"
          onClick={() => {
            ref.current?.getContext("2d")?.clearRect(0, 0, 700, 220);
            setHasInk(false);
            onChange(null);
          }}
        >
          <Eraser size={12} />
          Clear
        </button>
      </div>
      <canvas
        ref={ref}
        width={700}
        height={220}
        aria-label="Draw a visual signature with a pointer"
        onPointerDown={(e) => {
          const canvas = ref.current!,
            ctx = canvas.getContext("2d")!,
            p = position(e);
          drawing.current = true;
          canvas.setPointerCapture(e.pointerId);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.strokeStyle = "#202034";
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          setHasInk(true);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const p = position(e),
            ctx = ref.current!.getContext("2d")!;
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          ref.current?.toBlob((b) => onChange(b), "image/png");
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      {!hasInk && (
        <span className="signature-placeholder">Your signature here</span>
      )}
      <p>
        Or upload a signature image. The result is a visual signature, without a
        certificate.
      </p>
    </div>
  );
}
