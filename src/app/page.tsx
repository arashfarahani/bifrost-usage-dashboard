import { getAppName } from "@/config/branding";
import Link from "next/link";
import { Cpu, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/theme-switcher";
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-5">
      <header className="flex items-center justify-between py-7">
        <span
          className="flex items-center gap-2 text-sm font-semibold"
          dir="ltr"
        >
          <Cpu className="text-primary size-5" />
          {getAppName()}
        </span>
        <ThemeSwitcher />
      </header>
      <div className="flex flex-1 items-center justify-center py-16">
        <Card className="w-full max-w-lg shadow-none">
          <CardHeader className="space-y-5">
            <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
              <ShieldCheck className="size-7" />
            </div>
            <CardTitle className="text-2xl leading-normal">
              Your AI usage,
              <br />
              clearly in view.
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground text-sm leading-8">
              A clear view of your budget, model activity, and spending. Open
              your personal access link to get started.
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard">
                Open your dashboard
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Private access. No passwords. Read-only insights.
            </p>
          </CardContent>
        </Card>
      </div>
      <footer className="text-muted-foreground py-6 text-center text-xs">
        {getAppName()}
      </footer>
    </main>
  );
}
