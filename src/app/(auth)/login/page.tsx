import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.55_0.18_285_/_0.18),transparent_42%),radial-gradient(circle_at_bottom_right,oklch(0.65_0.16_190_/_0.12),transparent_38%)]" />
      <Suspense>
        <AuthForm />
      </Suspense>
    </main>
  );
}
