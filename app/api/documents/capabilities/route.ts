import { withJob, runWorker } from "@/lib/documents/service";
import { providerConfig } from "@/lib/ai/provider";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
let cached: Record<string, unknown> | null = null;
let expires = 0;
let loading: Promise<Record<string, unknown>> | null = null;
export async function GET() {
  const ai = !!(await providerConfig()).key;
  if (cached && Date.now() < expires)
    return Response.json(
      { ...cached, ai },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    loading ??= withJob(
      (dir) => runWorker(dir, { action: "capabilities" }),
      false,
    );
    const result = await loading;
    cached = result;
    expires = Date.now() + 30000;
    loading = null;
    return Response.json(
      { ...result, ai },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    loading = null;
    return Response.json(
      {
        engine: false,
        office: false,
        ocr: false,
        archive: false,
        ai,
        message:
          "Install the document engine or use the ACE Studio desktop package.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
