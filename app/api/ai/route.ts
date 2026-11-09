import { aiRequestSchema, interpretationSchema } from "@/lib/schema";
import { parsePrompt } from "@/lib/ai/parser";
import { interpretWithGemini } from "@/lib/ai/gemini";
import { guard, boundedBody, errorResponse } from "@/lib/server";
import { providerConfig } from "@/lib/ai/provider";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    guard(request, "ai");
    const { prompt, currentPlan, messages, imageMetadata } = aiRequestSchema.parse(
      JSON.parse((await boundedBody(request, 80000)).toString("utf8")),
    );
    const configured = !!(await providerConfig()).key;
    if (configured) {
      try {
        const result = await interpretWithGemini(prompt, currentPlan, messages, imageMetadata);
        const local = parsePrompt(prompt, currentPlan);
        // Deterministic safeguards override unsafe interpretation for explicit constraints.
        if (
          local.questions.length &&
          /exact|passport|application|university|bewerbung|پاسپورٹ/i.test(
            prompt,
          )
        )
          result.questions = local.questions;
        if (
          local.plan.resizeMode === "contain" &&
          /no.*crop|without.*crop|crop.*(?:na|mat)|ohne/i.test(prompt)
        )
          result.plan.resizeMode = "contain";
        return Response.json(
          { ...interpretationSchema.parse(result), mode: "ai" },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        /* No credentials or provider errors are exposed to the client. */
      }
    }
    const result = parsePrompt(prompt, currentPlan);
    // Invalid numeric requests need correction, not a server-side transformation.
    const checked = interpretationSchema.safeParse(result);
    if (!checked.success)
      return Response.json({
        plan: currentPlan,
        questions: [
          "These values exceed the supported settings. Please choose dimensions up to 12000 px, quality 1–100, and a positive size limit.",
        ],
        message: "Please adjust the requested values.",
        mode: "offline",
      });
    return Response.json(
      {
        ...checked.data,
        mode: "offline",
        fallback: configured,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
