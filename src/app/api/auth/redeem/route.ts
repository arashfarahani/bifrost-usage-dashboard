import { z } from "zod";
import { openAccess, sealSession } from "@/lib/auth/tokens";
import { assertOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/auth/rate-limit";
import { getVirtualKey } from "@/lib/bifrost/governance";
import { cookieName, cookieOptions } from "@/lib/auth/session";
import { json, errorResponse, readJSON } from "@/lib/http";
import { AppError } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    rateLimit("redeem", "", 30);
    const p = z
      .object({ token: z.string().min(1).max(4096) })
      .strict()
      .safeParse(await readJSON(request));
    if (!p.success) throw new AppError("INVALID_INPUT");
    const identity = await openAccess(p.data.token);
    await getVirtualKey(identity.virtualKeyId);
    const token = await sealSession(identity);
    const expiry = Math.min(
      Math.floor(Date.now() / 1000) + 3600,
      identity.linkExpiresAt ?? Infinity,
    );
    const r = json({ ok: true });
    r.cookies.set(cookieName(), token, {
      ...cookieOptions(),
      expires: new Date(expiry * 1000),
      maxAge: Math.max(0, expiry - Math.floor(Date.now() / 1000)),
    });
    return r;
  } catch (e) {
    return errorResponse(e);
  }
}
