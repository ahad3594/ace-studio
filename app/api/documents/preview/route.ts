import { z } from "zod";
import {
  readDocumentForm,
  withJob,
  writeInputs,
  runWorker,
} from "@/lib/documents/service";
import { guard, errorResponse, HttpError } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    guard(request, "metadata");
    const { form, files } = await readDocumentForm(request);
    if (files.length !== 1)
      throw new HttpError("Choose one PDF for a page preview.");
    const options = z
      .object({
        password: z.string().max(256).default(""),
        page: z.number().int().min(1).max(200),
      })
      .parse(JSON.parse(String(form.get("options") || "{}")));
    return await withJob(async (dir) => {
      const inputs = await writeInputs(dir, files);
      return Response.json(
        await runWorker(
          dir,
          { action: "preview", inputs, options, page: options.page },
          request.signal,
        ),
        { headers: { "Cache-Control": "no-store" } },
      );
    });
  } catch (e) {
    return errorResponse(e);
  }
}
