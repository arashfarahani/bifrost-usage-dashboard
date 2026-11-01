import "server-only";
import { openSession } from "./tokens";
import { getVirtualKey } from "@/lib/bifrost/governance";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/config/env";
import { rateLimit } from "./rate-limit";
export const cookieName = () =>
  process.env.NODE_ENV === "production"
    ? "__Host-llm-usage-session"
    : "llm-usage-session";
export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});
export async function authenticated(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  const matches = cookies
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(`${cookieName()}=`));
  if (matches.length !== 1) throw new AppError("INVALID_SESSION", 401);
  const token = matches[0].slice(cookieName().length + 1);
  rateLimit("dashboard-global", "", 1200);
  rateLimit("dashboard", token, 60);
  const identity = await openSession(token);
  const key = await getVirtualKey(identity.virtualKeyId);
  return {
    identity,
    session: {
      displayName: identity.displayName,
      expiresAt: identity.expiresAt,
      key,
      timezone: getEnv().APP_TIMEZONE,
    },
  };
}
