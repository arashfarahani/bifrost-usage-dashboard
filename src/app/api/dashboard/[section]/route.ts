import { authenticated } from "@/lib/auth/session";
import { getReport, getSummary } from "@/lib/bifrost/analytics";
import { getRequestVolume } from "@/lib/bifrost/histogram";
import { parseRange } from "@/lib/utils/dates";
import { json, errorResponse } from "@/lib/http";
import { AppError, safeError } from "@/lib/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ section: string }> },
) {
  try {
    const { section } = await context.params;
    if (!["overview", "budget", "usage", "models", "charts"].includes(section))
      return json(
        { error: { code: "NOT_FOUND", message: "Route not found." } },
        404,
      );
    const { identity, session } = await authenticated(request);
    const params = new URL(request.url).searchParams;
    if (section === "budget") {
      if (params.size) throw new AppError("INVALID_INPUT");
      return json({ budgets: session.key.budgets });
    }
    const range = parseRange(params, new Date(), session.timezone);
    if (section === "overview") {
      try {
        return json({
          session,
          usage: await getSummary(identity.virtualKeyId, range),
          analyticsError: null,
        });
      } catch (e) {
        const error = safeError(e);
        return json({
          session,
          usage: null,
          analyticsError: { code: error.code, message: error.message },
        });
      }
    }
    if (section === "charts") return json(await getRequestVolume(identity.virtualKeyId, range));
    if (section === "usage") return json(await getSummary(identity.virtualKeyId, range));
    const report = await getReport(identity.virtualKeyId, range);
    return json({ models: report.models, p95LatencyMs: report.health.p95LatencyMs });
  } catch (e) {
    return errorResponse(e);
  }
}
