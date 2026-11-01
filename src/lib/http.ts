import "server-only";
import { NextResponse } from "next/server";
import { AppError, safeError } from "@/lib/errors";
import { boundedText } from "@/lib/bifrost/client";
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function errorResponse(error: unknown) {
  const e = safeError(error);
  const r = json({ error: { code: e.code, message: e.message } }, e.status);
  if (e.status === 429) r.headers.set("Retry-After", "60");
  return r;
}
export async function readJSON(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json" ||
    Number(request.headers.get("content-length") ?? 0) > 6144
  )
    throw new AppError("INVALID_INPUT");
  try {
    return JSON.parse(await boundedText(new Response(request.body), 6144));
  } catch {
    throw new AppError("INVALID_INPUT");
  }
}
