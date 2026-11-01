import "server-only";
import { getEnv } from "@/config/env";
import { AppError } from "@/lib/errors";
export function assertOrigin(request: Request) {
  if (
    request.headers.get("origin") !== new URL(getEnv().APP_BASE_URL).origin ||
    ["cross-site", "same-site"].includes(
      request.headers.get("sec-fetch-site") ?? "",
    )
  )
    throw new AppError("FORBIDDEN", 403);
}
