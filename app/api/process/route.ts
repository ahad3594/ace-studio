import { planSchema } from "@/lib/schema";
import { processImage } from "@/lib/image/processor";
import { safeFilename } from "@/lib/batch";
import { acquire, errorResponse, guard, imageForm } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    guard(request, "process");
    release = acquire();
    const { file, form } = await imageForm(request);
    const plan = planSchema.parse(JSON.parse(String(form.get("plan"))));
    const { data, ...metadata } = await processImage(
      Buffer.from(await file.arrayBuffer()),
      plan,
    );
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": metadata.mime,
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="processed.${metadata.format === "jpeg" ? "jpg" : metadata.format}"; filename*=UTF-8''${encodeURIComponent(safeFilename(file.name, metadata.format))}`,
        "X-Image-Result": encodeURIComponent(JSON.stringify(metadata)),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  } finally {
    release?.();
  }
}
