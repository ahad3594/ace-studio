import { timingSafeEqual } from "node:crypto";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url),
    token = url.searchParams.get("token") || "",
    expected = process.env.ACE_DESKTOP_TOKEN || "";
  const a = Buffer.from(token),
    b = Buffer.from(expected);
  if (
    process.env.ACE_DESKTOP !== "true" ||
    !expected ||
    a.length !== b.length ||
    !timingSafeEqual(a, b)
  )
    return new Response("Invalid desktop session.", { status: 403 });
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/",
      "Set-Cookie": `ace-desktop=${expected}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
