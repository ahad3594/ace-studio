import {
  readDocumentForm,
  withJob,
  writeInputs,
  runWorker,
  outputResponse,
  documentRequestSchema,
} from "@/lib/documents/service";
import { toolBySlug } from "@/lib/documents/catalog";
import { providerConfig, generateText } from "@/lib/ai/provider";
import { guard, errorResponse, HttpError } from "@/lib/server";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    guard(request, "process");
    const { form, files } = await readDocumentForm(request);
    const payload = documentRequestSchema.parse(
      JSON.parse(String(form.get("settings"))),
    );
    if (!toolBySlug(payload.tool))
      throw new HttpError("Unknown document tool.");
    if (payload.tool !== "html-to-pdf" && !files.length)
      throw new HttpError("Choose your files first.");
    return await withJob(async (dir) => {
      const inputs = await writeInputs(dir, files);
      let result;
      if (
        payload.tool === "translate-pdf" ||
        (payload.tool === "ai-summarizer" &&
          payload.options.aiMode !== "local" &&
          payload.options.allowAI &&
          (await providerConfig()).key)
      ) {
        if (!payload.options.allowAI)
          throw new HttpError(
            "Allow sharing extracted document text with Gemini before using this AI operation.",
          );
        const extracted = await runWorker(
          dir,
          { tool: "extract-text", inputs, options: payload.options },
          request.signal,
        );
        const text = String(extracted.text || "");
        if (text.length > 80000)
          throw new HttpError(
            "Select fewer pages for the AI request (maximum 80,000 characters).",
          );
        const summary = payload.tool === "ai-summarizer";
        const generated = await generateText(
          summary
            ? "Summarize the supplied document accurately. Preserve qualifications and important numbers. Return plain text, never HTML or code. Identify uncertainty and do not claim facts absent from the document."
            : `Translate all supplied document text into the requested language. Preserve headings, paragraphs, meaning, numbers and names. Return only translated plain text; do not summarize.`,
          {
            document: text,
            ...(!summary ? { language: payload.options.targetLanguage } : {}),
          },
        );
        result = await runWorker(
          dir,
          {
            action: "render-text",
            text: generated,
            title: summary ? "ACE Studio AI summary" : "ACE Studio translation",
            warnings: [
              summary
                ? "Gemini generated this summary from the extracted text. Verify important details against the original."
                : "Translation is a newly typeset text document. Original page layout, figures and tables are not preserved.",
            ],
            stats: { mode: "gemini" },
          },
          request.signal,
        );
      } else
        result = await runWorker(
          dir,
          { action: "process", ...payload, inputs },
          request.signal,
        );
      return outputResponse(dir, result);
    });
  } catch (e) {
    return errorResponse(e);
  }
}
