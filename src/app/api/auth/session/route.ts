import { authenticated } from "@/lib/auth/session";
import { json, errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return json((await authenticated(request)).session);
  } catch (e) {
    return errorResponse(e);
  }
}
