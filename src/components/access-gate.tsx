"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
export function AccessGate() {
  const started = useRef(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragment = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    async function redeem() {
      const params = new URLSearchParams(fragment);
      const token = params.get("token");
      if (
        !token ||
        params.getAll("token").length !== 1 ||
        token.length > 4096
      ) {
        setError(
          "This access link is incomplete. Please open your full personal link.",
        );
        return;
      }
      try {
        const r = await fetch("/api/auth/redeem", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await r.json();
        if (!r.ok) {
          setError(
            data.error?.message ??
              "Unable to sign in. Please request a new access link.",
          );
          return;
        }
        router.replace("/dashboard");
      } catch {
        setError(
          "Unable to reach the service. Please reopen your personal link.",
        );
      }
    }
    void redeem();
  }, [router]);
  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="space-y-5">
        <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
          <KeyRound />
        </div>
        <CardTitle>Your private usage dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <p
            role="status"
            className="text-muted-foreground flex items-center gap-3"
          >
            <LoaderCircle className="size-4 animate-spin" />
            Verifying your secure access link…
          </p>
        )}
        <p className="text-muted-foreground text-sm leading-7">
          Keep your personal link private. Contact your infrastructure team if
          you need a new one.
        </p>
      </CardContent>
    </Card>
  );
}
