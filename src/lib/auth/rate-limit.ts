import "server-only";
import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";
// Transient process-local counters only. No identity, cookie, or user record is stored.
const counters = new Map<string, { count: number; until: number }>();
export function rateLimit(bucket: string, credential = "", limit = 60) {
  const now = Date.now();
  for (const [k, v] of counters) if (v.until <= now) counters.delete(k);
  const key = `${bucket}:${createHash("sha256").update(credential).digest("base64url")}`;
  const current = counters.get(key);
  if (current && current.count >= limit)
    throw new AppError("RATE_LIMITED", 429);
  if (!current && counters.size >= 5000)
    throw new AppError("RATE_LIMITED", 429);
  counters.set(
    key,
    current
      ? { ...current, count: current.count + 1 }
      : { count: 1, until: now + 60000 },
  );
}
