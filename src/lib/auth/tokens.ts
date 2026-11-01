import "server-only";
import { EncryptJWT, jwtDecrypt, base64url, errors } from "jose";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { AppError } from "@/lib/errors";
import type { Identity, AccessIdentity } from "@/types/dashboard";
export const keyIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/)
  .refine((v) => !v.startsWith("sk-") && !v.startsWith("bfvk-"));
const person = z.object({
  virtualKeyId: keyIdSchema,
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((v) => !/[\u0000-\u001f]/.test(v)),
});
const claims = person
  .extend({
    version: z.literal(1),
    iat: z.number().int().positive(),
    exp: z.number().int().positive().optional(),
    neverExpires: z.literal(true).optional(),
    iss: z.literal("llm-usage"),
    aud: z.string(),
    linkExpiresAt: z.number().int().positive().nullable().optional(),
  })
  .strict();
function cryptoConfig(kind: "access" | "session") {
  const env = getEnv();
  return {
    key: base64url.decode(
      kind === "access"
        ? env.ACCESS_TOKEN_ENCRYPTION_KEY
        : env.SESSION_ENCRYPTION_KEY,
    ),
    audience: kind === "access" ? "usage-dashboard" : "usage-session",
    typ: `llm-usage-${kind}+jwt`,
  };
}
async function seal(
  identity: z.infer<typeof person>,
  exp: number | null,
  kind: "access" | "session",
  linkExpiry?: number | null,
) {
  const c = cryptoConfig(kind);
  const jwt = new EncryptJWT({
    version: 1,
    ...person.parse(identity),
    ...(linkExpiry !== undefined ? { linkExpiresAt: linkExpiry } : {}),
    ...(exp === null ? { neverExpires: true } : {}),
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: c.typ })
    .setIssuer("llm-usage")
    .setAudience(c.audience)
    .setIssuedAt();
  if (exp !== null) jwt.setExpirationTime(exp);
  return jwt.encrypt(c.key);
}
export async function sealAccess(
  identity: z.infer<typeof person>,
  lifetimeSeconds: number | null = 30 * 86400,
): Promise<string> {
  if (
    lifetimeSeconds !== null &&
    (!Number.isSafeInteger(lifetimeSeconds) ||
      lifetimeSeconds < 1 ||
      lifetimeSeconds > 365 * 86400)
  )
    throw new AppError("INVALID_INPUT");
  return seal(
    identity,
    lifetimeSeconds === null
      ? null
      : Math.floor(Date.now() / 1000) + lifetimeSeconds,
    "access",
  );
}
async function open(
  token: string,
  kind: "access" | "session",
): Promise<AccessIdentity> {
  const c = cryptoConfig(kind);
  try {
    if (!token || token.length > 4096) throw new Error("invalid");
    const { payload, protectedHeader } = await jwtDecrypt(token, c.key, {
      issuer: "llm-usage",
      audience: c.audience,
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
      requiredClaims: [
        "iat",
        "iss",
        "aud",
        ...(kind === "session" ? ["exp"] : []),
      ],
    });
    const p = claims.parse(payload);
    const now = Math.floor(Date.now() / 1000);
    if (
      protectedHeader.typ !== c.typ ||
      p.iat > now + 30 ||
      (p.exp !== undefined &&
        (p.exp <= p.iat ||
          p.exp - p.iat > (kind === "access" ? 365 * 86400 : 3600)))
    )
      throw new Error("invalid");
    if (
      kind === "session" &&
      (p.neverExpires ||
        p.linkExpiresAt === undefined ||
        (p.linkExpiresAt !== null &&
          (p.exp! > p.linkExpiresAt || p.linkExpiresAt <= now)))
    )
      throw new Error("invalid");
    if (
      kind === "access" &&
      (p.linkExpiresAt !== undefined ||
        (p.exp === undefined
          ? p.neverExpires !== true
          : p.neverExpires !== undefined))
    )
      throw new Error("invalid");
    return {
      virtualKeyId: p.virtualKeyId,
      displayName: p.displayName,
      expiresAt: p.exp ?? null,
      linkExpiresAt: kind === "access" ? (p.exp ?? null) : p.linkExpiresAt!,
    };
  } catch (err) {
    throw new AppError(
      kind === "session"
        ? "INVALID_SESSION"
        : err instanceof errors.JWTExpired
          ? "EXPIRED_TOKEN"
          : "INVALID_TOKEN",
      401,
    );
  }
}
export const openAccess = (token: string) => open(token, "access");
export const openSession = async (token: string): Promise<Identity> => {
  const identity = await open(token, "session");
  return { ...identity, expiresAt: identity.expiresAt! };
};
export async function sealSession(identity: AccessIdentity): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.min(now + 3600, identity.linkExpiresAt ?? Infinity);
  if (exp <= now) throw new AppError("EXPIRED_TOKEN", 401);
  return seal(identity, exp, "session", identity.linkExpiresAt);
}
