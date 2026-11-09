import { limits } from "./config.ts";
const state = globalThis as typeof globalThis & {
  pfRates?: Map<string, { n: number; reset: number }>;
  pfActive?: number;
};
state.pfRates ??= new Map();
export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function guard(request: Request, group: "ai" | "process" | "metadata") {
  const origin = request.headers.get("origin");
  if (origin) {
    const internal = new URL(request.url);
    // Standalone Next can rebuild request.url with its internal bind hostname.
    // Host is the browser-facing HTTP authority, not that internal hostname.
    const host = request.headers.get("host") || internal.host;
    const forwarded =
      process.env.TRUST_PROXY === "true"
        ? request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
        : null;
    const protocol =
      forwarded === "https" || forwarded === "http"
        ? `${forwarded}:`
        : internal.protocol;
    let supplied: URL;
    try {
      supplied = new URL(origin);
    } catch {
      throw new HttpError("Invalid request origin.", 403);
    }
    if (supplied.host !== host || supplied.protocol !== protocol)
      throw new HttpError("Cross-origin requests are not allowed.", 403);
  }
  const ip =
    process.env.TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "shared"
      : "shared";
  const key = `${group}:${ip}`,
    now = Date.now(),
    map = state.pfRates!;
  for (const [k, v] of map) if (v.reset < now) map.delete(k);
  if (map.size > 10000 && !map.has(key))
    throw new HttpError("Server is busy. Please retry shortly.", 429);
  const entry = map.get(key) ?? { n: 0, reset: now + 60000 };
  entry.n++;
  map.set(key, entry);
  if (entry.n > (group === "ai" ? limits.aiRate : limits.processRate))
    throw new HttpError("Too many requests. Please retry in a minute.", 429);
}
export function acquire() {
  if ((state.pfActive ?? 0) >= limits.concurrency)
    throw new HttpError("Image engine is busy. Please retry shortly.", 429);
  state.pfActive = (state.pfActive ?? 0) + 1;
  return () => {
    state.pfActive = Math.max(0, (state.pfActive ?? 1) - 1);
  };
}
export async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new HttpError("Request exceeds the upload limit.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("Request body is missing.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  const timer = setTimeout(() => {
    void reader.cancel();
  }, 30000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        throw new HttpError("Request exceeds the upload limit.", 413);
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
export async function imageForm(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data;"))
    throw new HttpError("Expected an image upload.");
  const body = await boundedBody(request, limits.maxBytes + 65536);
  const form = await new Response(new Uint8Array(body), {
    headers: { "Content-Type": contentType },
  }).formData();
  const file = form.get("image");
  if (!(file instanceof File)) throw new HttpError("Please upload one image.");
  return { file, form };
}
export function errorResponse(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Something went wrong. Please retry.";
  const status = error instanceof HttpError ? error.status : 400;
  return Response.json(
    {
      error: message.startsWith("[")
        ? "Invalid processing settings. Please review the plan."
        : message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}
