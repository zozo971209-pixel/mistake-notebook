"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, Home, Map, Menu, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const nav = [
  { href: "/dashboard", label: "首頁", icon: Home },
  { href: "/outline", label: "學習地圖", icon: Map },
  { href: "/questions", label: "錯題庫", icon: BookOpenCheck },
  { href: "/settings", label: "設定", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navigation = <nav className="grid gap-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground", pathname === href && "bg-accent text-foreground")}><Icon className="size-4" />{label}</Link>)}</nav>;

  return <div className="min-h-screen bg-background">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar/95 p-5 shadow-[8px_0_30px_rgb(24_32_51_/_0.03)] backdrop-blur lg:flex lg:flex-col">
      <Link href="/dashboard" className="mb-6 flex items-center gap-3 px-2"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Map className="size-5" /></span><strong>學習地圖</strong></Link>
      <Button asChild className="mb-5 w-full justify-start"><Link href="/questions/new"><Plus />新增錯題</Link></Button>
      {navigation}
      <p className="mt-auto border-t px-2 pt-4 text-xs leading-5 text-muted-foreground">資料只保存在這個瀏覽器。</p>
    </aside>
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card/90 px-4 backdrop-blur lg:hidden">
      <Link href="/dashboard" className="font-semibold">學習地圖</Link>
      <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-72 p-5"><SheetHeader className="mb-6 text-left"><SheetTitle>學習地圖</SheetTitle></SheetHeader><Button asChild className="mb-5 w-full justify-start"><Link href="/questions/new"><Plus />新增錯題</Link></Button>{navigation}</SheetContent></Sheet>
    </header>
    <main className="lg:pl-64"><div className="mx-auto w-full max-w-7xl p-4 pb-24 sm:p-8 lg:pb-8">{children}</div></main>
    <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl border bg-card/95 p-1.5 shadow-[0_12px_35px_rgb(24_32_51_/_0.14)] backdrop-blur lg:hidden">
      {nav.slice(0, 2).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] text-muted-foreground", pathname === href && "bg-accent text-foreground")}><Icon className="size-4" />{label}</Link>)}
      <Link href="/questions/new" aria-label="新增錯題" className="mx-auto flex size-12 -translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"><Plus className="size-5" /></Link>
      {nav.slice(2).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] text-muted-foreground", pathname === href && "bg-accent text-foreground")}><Icon className="size-4" />{label}</Link>)}
    </nav>
  </div>;
}
