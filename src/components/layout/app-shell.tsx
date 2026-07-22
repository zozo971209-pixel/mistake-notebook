"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpenCheck, BrainCircuit, LayoutDashboard, LogOut, Menu, Plus, RotateCcw, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const nav = [
  { href: "/dashboard", label: "總覽", icon: LayoutDashboard },
  { href: "/questions", label: "錯題庫", icon: BookOpenCheck },
  { href: "/questions/new", label: "新增錯題", icon: Plus },
  { href: "/review", label: "今日複習", icon: RotateCcw },
  { href: "/statistics", label: "學習分析", icon: BarChart3 },
  { href: "/settings", label: "AI 與設定", icon: Settings },
];

export function AppShell({ children, email }: { children: React.ReactNode; email?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const navigation = (
    <nav className="grid gap-1">
      {nav.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground", pathname === href && "bg-accent text-foreground")}>
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card/50 p-5 backdrop-blur lg:flex lg:flex-col">
        <Link href="/dashboard" className="mb-8 flex items-center gap-3 px-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BrainCircuit className="size-5" /></span>
          <span><strong className="block">錯題・再理解</strong><small className="text-muted-foreground">Mistake Notebook</small></span>
        </Link>
        {navigation}
        <div className="mt-auto space-y-3 border-t pt-4">
          <p className="truncate px-2 text-xs text-muted-foreground">{email}</p>
          <Button variant="ghost" className="w-full justify-start" onClick={logout}><LogOut />登出</Button>
        </div>
      </aside>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="font-semibold">錯題・再理解</Link>
        <Sheet>
          <SheetTrigger asChild><Button variant="ghost" size="icon"><Menu /></Button></SheetTrigger>
          <SheetContent side="left" className="w-72 p-5">
            <SheetHeader className="mb-6 text-left"><SheetTitle>學習選單</SheetTitle></SheetHeader>
            {navigation}
            <Button variant="ghost" className="mt-6 w-full justify-start" onClick={logout}><LogOut />登出</Button>
          </SheetContent>
        </Sheet>
      </header>
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl p-5 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
