import type { Metadata } from "next";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import "./globals.css";
import { getAppName } from "@/config/branding";
export function generateMetadata(): Metadata {
  return {
    title: getAppName(),
    description: "Your personal LLM usage and budget dashboard.",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
