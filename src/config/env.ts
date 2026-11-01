import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
const key = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/)
  .refine((v) => Buffer.from(v, "base64url").length === 32);
const schema = z.object({
  APP_BASE_URL: z.url().refine((v) => {
    const u = new URL(v);
    return (
      ["http:", "https:"].includes(u.protocol) &&
      u.pathname === "/" &&
      !u.search &&
      !u.hash &&
      !u.username &&
      !u.password
    );
  }),
  APP_TIMEZONE: z
    .string()
    .default("Asia/Tehran")
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
  BIFROST_BASE_URL: z.url().refine((v) => {
    const u = new URL(v);
    return (
      ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      u.pathname === "/"
    );
  }),
  BIFROST_ADMIN_USERNAME: z
    .string()
    .min(1)
    .max(256)
    .refine((v) => !v.includes(":") && !/[\r\n]/.test(v)),
  BIFROST_ADMIN_PASSWORD: z
    .string()
    .min(1)
    .max(2048)
    .refine((v) => !/[\r\n]/.test(v)),
  ACCESS_TOKEN_ENCRYPTION_KEY: key,
  SESSION_ENCRYPTION_KEY: key,
  BIFROST_TIMEOUT_MS: z.coerce.number().int().min(100).max(15000).default(8000),
});
export function getEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) throw new AppError("CONFIGURATION", 503);
  const e = result.data;
  if (e.ACCESS_TOKEN_ENCRYPTION_KEY === e.SESSION_ENCRYPTION_KEY)
    throw new AppError("CONFIGURATION", 503);
  if (
    process.env.NODE_ENV === "production" &&
    !e.APP_BASE_URL.startsWith("https://")
  )
    throw new AppError("CONFIGURATION", 503);
  return e;
}
