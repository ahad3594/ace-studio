import { routerRequestSchema, routeWithAI } from "@/lib/ai/tool-router";
import { guard, boundedBody, errorResponse } from "@/lib/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    guard(request, "ai");
    const input = routerRequestSchema.parse(
      JSON.parse((await boundedBody(request, 50000)).toString()),
    );
    return Response.json(await routeWithAI(input), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
