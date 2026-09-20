"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenCheck, ChevronRight, Home, Map, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppPlatform } from "@/lib/app-platform";
import { useLocalData } from "@/lib/local-data/provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { InstallPromptCapture } from "@/components/settings/install-app-card";
import { AppLogo } from "@/components/layout/app-logo";

const SIDEBAR_STORAGE_KEY = "learning-map-windows-sidebar-collapsed";
const SIDEBAR_EVENT = "learning-map-sidebar-change";
const nav = [
  { href: "/dashboard", label: "首頁", icon: Home },
  { href: "/outline", label: "學習地圖", icon: Map },
  { href: "/questions", label: "錯題庫", icon: BookOpenCheck },
  { href: "/settings", label: "設定", icon: Settings },
];

function isRouteActive(pathname: string, href: string) {
  const currentPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (href === "/dashboard") return currentPath === href;
  if (href === "/outline") return ["/outline", "/node", "/subject"].some((route) => currentPath === route || currentPath.startsWith(`${route}/`));
  if (href === "/questions") return ["/questions", "/question", "/review"].some((route) => currentPath === route || currentPath.startsWith(`${route}/`));
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const platform = useAppPlatform();
  const collapsed = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(SIDEBAR_EVENT, onChange);
      return () => { window.removeEventListener("storage", onChange); window.removeEventListener(SIDEBAR_EVENT, onChange); };
    },
    () => platform === "windows" && window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true",
    () => false,
  );

  function toggleSidebar() {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!collapsed));
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  const navigation = (compact = false) => <nav className="grid gap-1.5" aria-label="主要導覽">{nav.map(({ href, label, icon: Icon }) => {
    const active = isRouteActive(pathname, href);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} title={compact ? label : undefined} className={cn("relative flex min-h-10 items-center rounded-xl text-sm font-medium transition-colors", compact ? "justify-center px-2" : "gap-3 px-3", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" />}
      <Icon className="size-[18px]" />
      {!compact && <span>{label}</span>}
    </Link>;
  })}</nav>;

  if (platform === "windows") {
    return <div className="min-h-screen bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-30 flex flex-col border-r bg-sidebar/95 py-4 shadow-[8px_0_30px_rgb(24_32_51_/_0.03)] backdrop-blur transition-[width] duration-200", collapsed ? "w-16 px-2" : "w-[216px] px-3")}>
        <div className={cn("mb-5 flex items-center", collapsed ? "flex-col gap-2" : "justify-between gap-2 px-1")}>
          {!collapsed && <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5"><AppLogo size={34} /><strong className="truncate text-[15px]">學習地圖</strong></Link>}
          <Button variant="ghost" size="icon" className="size-8" onClick={toggleSidebar} title={collapsed ? "展開側邊欄" : "收合側邊欄"} aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
        </div>
        <Button asChild className={cn("mb-3", collapsed ? "size-10 self-center px-0" : "w-full justify-start")} title={collapsed ? "新增錯題" : undefined}><Link href="/questions/new"><Plus />{!collapsed && "新增錯題"}</Link></Button>
        <DesktopGlobalSearch collapsed={collapsed} />
        <div className="mt-3">{navigation(collapsed)}</div>
      </aside>
      <main className={cn("transition-[padding] duration-200", collapsed ? "pl-16" : "pl-[216px]")}><div className="mx-auto w-full max-w-[1240px] p-6 xl:p-8">{children}</div></main>
    </div>;
  }

  return <div className="min-h-screen bg-background">
    <InstallPromptCapture />
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar/95 p-5 shadow-[8px_0_30px_rgb(24_32_51_/_0.03)] backdrop-blur lg:flex lg:flex-col">
      <Link href="/dashboard" className="mb-6 flex items-center gap-3 px-2"><AppLogo size={40} /><strong>學習地圖</strong></Link>
      <Button asChild className="mb-5 w-full justify-start"><Link href="/questions/new"><Plus />新增錯題</Link></Button>
      {navigation()}
      <p className="mt-auto border-t px-2 pt-4 text-xs leading-5 text-muted-foreground">資料只保存在這個瀏覽器。</p>
    </aside>
    <header className="mobile-app-header sticky z-20 flex h-16 items-center justify-between border-b bg-card/90 px-4 backdrop-blur lg:hidden">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold"><AppLogo size={32} />學習地圖</Link>
      <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon"><Menu /></Button></SheetTrigger><SheetContent side="left" className="w-72 p-5"><SheetHeader className="mb-6 text-left"><SheetTitle>學習地圖</SheetTitle></SheetHeader><Button asChild className="mb-5 w-full justify-start"><Link href="/questions/new"><Plus />新增錯題</Link></Button>{navigation()}</SheetContent></Sheet>
    </header>
    <main className="min-w-0 lg:pl-64"><div className="mobile-main-content mx-auto min-w-0 w-full max-w-7xl p-4 sm:p-8">{children}</div></main>
    <nav className="mobile-bottom-nav fixed z-30 grid grid-cols-5 rounded-2xl border bg-card/95 p-1.5 shadow-[0_12px_35px_rgb(24_32_51_/_0.14)] backdrop-blur lg:hidden">
      {nav.slice(0, 2).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] text-muted-foreground", isRouteActive(pathname, href) && "bg-accent text-foreground")}><Icon className="size-4" />{label}</Link>)}
      <Link href="/questions/new" aria-label="新增錯題" className="mx-auto flex size-12 -translate-y-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"><Plus className="size-5" /></Link>
      {nav.slice(2).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] text-muted-foreground", isRouteActive(pathname, href) && "bg-accent text-foreground")}><Icon className="size-4" />{label}</Link>)}
    </nav>
  </div>;
}

function DesktopGlobalSearch({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const data = useLocalData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchIndex = useMemo(() => [
    ...data.subjects.map((item) => ({ id: `subject-${item.id}`, title: item.name, type: "主題", href: `/subject?id=${encodeURIComponent(item.id)}`, text: `${item.name} ${learningContentText(item.content)}`.toLocaleLowerCase("zh-TW") })),
    ...data.nodes.map((item) => ({ id: `node-${item.id}`, title: item.name, type: "節點", href: `/node?id=${encodeURIComponent(item.id)}`, text: `${item.name} ${learningContentText(item.content)}`.toLocaleLowerCase("zh-TW") })),
    ...data.questions.map((item) => ({ id: `question-${item.id}`, title: item.title || item.question_text, type: "錯題", href: `/question?id=${encodeURIComponent(item.id)}`, text: `${item.title ?? ""} ${item.question_text} ${item.error_note ?? ""}`.toLocaleLowerCase("zh-TW") })),
  ], [data.nodes, data.questions, data.subjects]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-TW");
    if (!needle) return [];
    return searchIndex.filter((item) => item.text.includes(needle)).slice(0, 24);
  }, [query, searchIndex]);

  function openResult(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return <>
    <Button variant="ghost" className={cn("text-muted-foreground", collapsed ? "size-10 self-center px-0" : "w-full justify-start")} onClick={() => setOpen(true)} title={collapsed ? "搜尋（Ctrl+K）" : undefined}><Search />{!collapsed && <><span>搜尋</span><kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">Ctrl K</kbd></>}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>搜尋學習資料</DialogTitle><DialogDescription>搜尋主題、節點內容與錯題。</DialogDescription></DialogHeader>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="輸入名稱或內容…" autoFocus />
        <div className="max-h-[55vh] space-y-1 overflow-y-auto">
          {query.trim() && results.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">找不到符合內容。</p>}
          {results.map((result) => <button key={result.id} type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-accent" onClick={() => openResult(result.href)}><span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{result.type}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{result.title}</span><ChevronRight className="size-4 text-muted-foreground" /></button>)}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

function learningContentText(content: string) {
  if (!content) return "";
  try {
    const parsed = JSON.parse(content) as unknown;
    const strings: string[] = [];
    const visit = (value: unknown, key = "") => {
      if (key === "src") return;
      if (typeof value === "string") { if (value.length < 5000) strings.push(value); return; }
      if (Array.isArray(value)) { value.forEach((entry) => visit(entry)); return; }
      if (value && typeof value === "object") Object.entries(value).forEach(([entryKey, entry]) => visit(entry, entryKey));
    };
    visit(parsed);
    return strings.join(" ");
  } catch {
    return content.replace(/<[^>]+>/g, " ");
  }
}
