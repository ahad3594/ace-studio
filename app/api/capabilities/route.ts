import sharp from "sharp";
import { limits } from "@/lib/config";
import { providerConfig } from "@/lib/ai/provider";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    {
      ai: !!(await providerConfig()).key,
      maxImages: limits.maxImages,
      maxBytes: limits.maxBytes,
      inputPixels: limits.inputPixels,
      heif: !!sharp.format.heif?.input?.buffer,
      notice:
        "HEIC decoding depends on the libvips build. Individual files may require a system libheif codec.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
