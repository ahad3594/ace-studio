import { z } from "zod";
import {
  providerConfig,
  desktopAuthorized,
  storeProvider,
  generateText,
} from "@/lib/ai/provider";
import { boundedBody, errorResponse, guard, HttpError } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const config = await providerConfig();
  return Response.json(
    {
      configured: !!config.key,
      source: config.source,
      model: config.model,
      canConfigure: desktopAuthorized(request),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    guard(request, "ai");
    if (!desktopAuthorized(request))
      throw new HttpError(
        "Provider setup is available only inside the authenticated local desktop app.",
        403,
      );
    const body = z
      .object({
        key: z.string().min(10).max(256).optional(),
        model: z
          .string()
          .regex(/^[a-zA-Z0-9._-]{3,80}$/)
          .default("gemini-2.5-flash"),
        test: z.boolean().default(false),
      })
      .strict()
      .parse(JSON.parse((await boundedBody(request, 2000)).toString()));
    const current = await providerConfig();
    if (body.key || (current.source === "desktop" && current.key))
      await storeProvider(body.key || current.key, body.model);
    if (body.test)
      await generateText("Reply with the single word READY.", {
        request: "Connection test",
      });
    return Response.json(
      { configured: !!(await providerConfig()).key, tested: body.test },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
