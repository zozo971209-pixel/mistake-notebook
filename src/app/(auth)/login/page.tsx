import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgb(79_70_229_/_0.12),transparent_42%),radial-gradient(circle_at_bottom_right,rgb(47_158_115_/_0.08),transparent_38%)]" />
      <Suspense>
        <AuthForm />
      </Suspense>
    </main>
  );
}
