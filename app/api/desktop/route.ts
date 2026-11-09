import { desktopAuthorized } from "@/lib/ai/provider";
import { guard, errorResponse, HttpError } from "@/lib/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!desktopAuthorized(request))
    return Response.json(
      { desktop: false, app: "ACE Studio" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  return Response.json(
    { desktop: true, app: "ACE Studio", version: "2.0.0" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    guard(request, "process");
    if (!desktopAuthorized(request))
      throw new HttpError(
        "This action requires the local desktop session.",
        403,
      );
    setTimeout(() => {
      process.kill(process.pid, "SIGTERM");
    }, 500);
    return Response.json(
      { stopping: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
