import { assertOrigin } from "@/lib/auth/origin";
import { cookieName, cookieOptions } from "@/lib/auth/session";
import { json, errorResponse } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const r = json({ ok: true });
    r.cookies.set(cookieName(), "", {
      ...cookieOptions(),
      maxAge: 0,
      expires: new Date(0),
    });
    return r;
  } catch (e) {
    return errorResponse(e);
  }
}
