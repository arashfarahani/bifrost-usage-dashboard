import { AccessGate } from "@/components/access-gate";
export default function AccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <AccessGate />
    </main>
  );
}
