import "server-only";

// Resolve names on the server for every request, including the legacy setting.
// Reading through the environment object prevents NEXT_PUBLIC_APP_NAME from
// being replaced with a build-time constant by Next.js.
export function getAppName(): string {
  const environment = process.env;
  const name =
    environment.APP_NAME?.trim() || environment.NEXT_PUBLIC_APP_NAME?.trim();
  return name?.slice(0, 100) || "bifrost-usage-dashboard";
}
