import { z } from "zod";
import {
  readDocumentForm,
  withJob,
  writeInputs,
  runWorker,
} from "@/lib/documents/service";
import { guard, errorResponse } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    guard(request, "metadata");
    const { form, files } = await readDocumentForm(request);
    const options = z
      .object({ password: z.string().max(256).default("") })
      .parse(JSON.parse(String(form.get("options") || "{}")));
    return await withJob(async (dir) => {
      const inputs = await writeInputs(dir, files);
      const result = await runWorker(
        dir,
        { action: "inspect", inputs, options },
        request.signal,
      );
      return Response.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    });
  } catch (e) {
    return errorResponse(e);
  }
}
