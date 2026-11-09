import { inspectImage, inputPipeline } from "@/lib/image/metadata";
import { acquire, errorResponse, guard, imageForm } from "@/lib/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    guard(request, "metadata");
    release = acquire();
    const { file } = await imageForm(request);
    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = await inspectImage(buffer);
    const preview = await inputPipeline(buffer)
      .autoOrient()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return Response.json(
      {
        ...metadata,
        preview: `data:image/webp;base64,${preview.toString("base64")}`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  } finally {
    release?.();
  }
}
