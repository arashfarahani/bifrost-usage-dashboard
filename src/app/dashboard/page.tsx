import { getAppName } from "@/config/branding";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName } from "@/lib/auth/session";
import { Dashboard } from "@/components/dashboard/dashboard";
export default async function DashboardPage() {
  if (!(await cookies()).has(cookieName())) redirect("/access");
  return <Dashboard appName={getAppName()} timezone={process.env.APP_TIMEZONE ?? "Asia/Tehran"} />;
}
