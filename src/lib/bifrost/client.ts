import "server-only";
import { getEnv } from "@/config/env";
import { AppError } from "@/lib/errors";
export async function boundedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maxBytes) throw new AppError("INVALID_INPUT");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function bifrostGet(
  path: string,
  params?: URLSearchParams,
  signal?: AbortSignal,
): Promise<unknown> {
  const env = getEnv();
  if (
    !/^\/api\/governance\/virtual-keys\/[A-Za-z0-9_-]+$/.test(path) &&
    !["/api/logs", "/api/logs/stats", "/api/logs/histogram"].includes(path)
  )
    throw new AppError("FORBIDDEN", 403);
  const url = new URL(path, env.BIFROST_BASE_URL);
  url.search = params?.toString() ?? "";
  const timeout = AbortSignal.timeout(env.BIFROST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      // Inspect the status without forwarding credentials to the redirect target.
      redirect: "manual",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.BIFROST_ADMIN_USERNAME}:${env.BIFROST_ADMIN_PASSWORD}`).toString("base64")}`,
        Accept: "application/json",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new AppError("BIFROST_REDIRECT", 503);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new AppError(
        response.status === 404
          ? "KEY_NOT_FOUND"
          : [401, 403].includes(response.status)
            ? "BIFROST_AUTH"
            : response.status === 429
              ? "RATE_LIMITED"
              : "BIFROST_UNAVAILABLE",
        response.status === 404 ? 404 : response.status === 429 ? 429 : 503,
      );
    }
    const text = await boundedText(response, 4 * 1024 * 1024);
    try {
      return JSON.parse(text);
    } catch {
      throw new AppError("UPSTREAM_SCHEMA", 502);
    }
  } catch (err) {
    if (err instanceof AppError)
      throw err.code === "INVALID_INPUT"
        ? new AppError("UPSTREAM_SCHEMA", 502)
        : err;
    if (timeout.aborted || signal?.aborted)
      throw new AppError("BIFROST_TIMEOUT", 504);
    throw new AppError("BIFROST_UNAVAILABLE", 503);
  }
}
