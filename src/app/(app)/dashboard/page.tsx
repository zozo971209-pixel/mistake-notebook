"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowRight, BookOpenCheck, Boxes, CheckCircle2, CircleDot, Database, Map as MapIcon, Plus, RotateCcw } from "lucide-react";
import { useAppPlatform } from "@/lib/app-platform";
import { useLocalData } from "@/lib/local-data/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { ready, error, questions, reviews, subjects, settings } = useLocalData();
  const platform = useAppPlatform();
  const [currentTime] = useState(() => Date.now());
  if (!ready) return <DashboardSkeleton />;
  if (error) return <p className="rounded-2xl border border-destructive/40 p-5 text-destructive">{error}</p>;
  const active = questions.filter((item) => item.status !== "archived");
  const due = active.filter((item) => Date.parse(item.next_review_at) <= currentTime);
  const recentReviews = reviews.filter((item) => currentTime - Date.parse(item.reviewed_at) <= 7 * 86400000);
  const correct = recentReviews.filter((item) => item.result === "correct" || item.result === "easy").length;
  const accuracy = recentReviews.length ? Math.round(correct / recentReviews.length * 100) : 0;
  const recent = active.slice(0, 4);
  const subjectScores = subjects.map((subject) => {
    const related = active.filter((item) => item.subject_id === subject.id);
    return { ...subject, count: related.length, score: related.length ? Math.round(related.reduce((sum, item) => sum + item.mastery_score, 0) / related.length) : 0 };
  }).filter((item) => item.count).sort((a, b) => a.score - b.score).slice(0, 4);

  if (platform === "windows") return <WindowsDashboard />;

  return <div className="dashboard-page space-y-6 sm:space-y-8">
    <section className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.10] via-card to-card p-5 sm:p-8">
      <div className="grid items-center gap-5 sm:gap-8 lg:grid-cols-[1fr_280px]"><div><p className="text-sm font-medium text-primary">本機學習工作區</p><h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">把錯題放回知識脈絡</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">建立自己的主題架構，將每一道錯題連到節點，再按熟練度持續重作。</p><div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6 sm:gap-3"><Button asChild size="default" className="h-10 px-4 sm:h-11 sm:px-5"><Link href="/outline"><MapIcon />整理學習地圖</Link></Button><Button asChild size="default" variant="outline" className="h-10 px-4 sm:h-11 sm:px-5"><Link href="/questions/new"><Plus />新增錯題</Link></Button>{active.length > 0 && <Button asChild size="default" variant="ghost" className="h-10 px-4 sm:h-11 sm:px-5"><Link href="/review"><RotateCcw />開始複習</Link></Button>}</div></div><div className="rounded-2xl bg-background/60 p-4 text-center sm:p-5"><div className="mx-auto flex size-24 items-center justify-center rounded-full border-[8px] border-primary/20 text-2xl font-semibold text-primary sm:size-28 sm:border-[10px] sm:text-3xl">{Math.min(due.length, settings.daily_review_target)}<span className="ml-1 text-sm text-muted-foreground">/{settings.daily_review_target}</span></div><p className="mt-3 text-sm text-muted-foreground sm:mt-4">今日待複習</p></div></div>
    </section>
    <section className="grid divide-y rounded-2xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0"><Metric icon={BookOpenCheck} label="錯題總數" value={String(active.length)} /><Metric icon={CheckCircle2} label="近七日正確率" value={`${accuracy}%`} /><Metric icon={Database} label="資料位置" value="此裝置" /></section>
    <section className="grid gap-8 lg:grid-cols-[1fr_320px]"><div><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">最近錯題</h2><Button asChild variant="ghost" size="sm"><Link href="/questions">查看全部<ArrowRight /></Link></Button></div><div className="divide-y overflow-hidden rounded-2xl border bg-card">{recent.length === 0 && <div className="p-10 text-center"><p className="font-medium">還沒有錯題</p><p className="mt-1 text-sm text-muted-foreground">先新增一題，學習進度會從這裡開始。</p></div>}{recent.map((question) => { const subject = subjects.find((item) => item.id === question.subject_id); return <Link key={question.id} href={`/question?id=${encodeURIComponent(question.id)}`} className="flex items-center gap-4 p-4 transition hover:bg-accent/55"><span className="h-10 w-1 rounded-full" style={{ backgroundColor: subject?.color ?? "#4f46e5" }} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2">{subject && <Badge variant="secondary">{subject.name}</Badge>}<span className="truncate text-sm font-medium">{question.title || question.question_text}</span></div><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{question.chapter || "尚未連結節點"}</p></div><span className="font-mono text-sm text-primary">{question.mastery_score}%</span></Link>; })}</div></div><div><h2 className="mb-4 text-lg font-semibold">優先加強</h2><Card><CardContent className="space-y-5 p-5">{subjectScores.length === 0 && <p className="text-sm text-muted-foreground">加入錯題後，這裡會顯示較弱主題。</p>}{subjectScores.map((subject) => <div key={subject.id}><div className="mb-2 flex justify-between text-sm"><span>{subject.name}</span><span className="font-mono text-muted-foreground">{subject.score}%</span></div><Progress value={subject.score} /></div>)}</CardContent></Card></div></section>
  </div>;
}

function WindowsDashboard() {
  const { questions, subjects, nodes } = useLocalData();
  const [mapOpen, setMapOpen] = useState(false);
  const activeQuestions = questions.filter((item) => item.status !== "archived");
  const lastNodeId = useSyncExternalStore(() => () => undefined, () => window.localStorage.getItem("learning-map-last-node-id") ?? "", () => "");
  const fallbackNode = [...nodes].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null;
  const lastNode = nodes.find((node) => node.id === lastNodeId) ?? fallbackNode;
  const lastSubject = subjects.find((subject) => subject.id === lastNode?.subject_id) ?? null;

  return <div className="space-y-6">
    <section className="grid gap-4 lg:grid-cols-3">
      <button type="button" onClick={() => setMapOpen(true)} className="group flex min-h-44 flex-col justify-between rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><MapIcon className="size-5" /></span>
        <span><strong className="block text-lg">進入學習地圖</strong><small className="mt-1 block leading-5 text-muted-foreground">先選擇主題，再選擇要進入的架構圖。</small></span>
      </button>
      {lastNode ? <Link href={`/node?id=${encodeURIComponent(lastNode.id)}`} className="group flex min-h-44 flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
        <span className="flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><RotateCcw className="size-5" /></span>
        <span><strong className="block text-lg">繼續上次節點</strong><small className="mt-1 block truncate leading-5 text-muted-foreground">{lastSubject?.name ? `${lastSubject.name} · ` : ""}{lastNode.name}</small></span>
      </Link> : <div className="flex min-h-44 flex-col justify-between rounded-2xl border border-dashed bg-card/50 p-5 text-left">
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><RotateCcw className="size-5" /></span>
        <span><strong className="block text-lg text-muted-foreground">繼續上次節點</strong><small className="mt-1 block leading-5 text-muted-foreground">開啟任一節點後，這裡會記住位置。</small></span>
      </div>}
      <Link href="/questions/new" className="group flex min-h-44 flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
        <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Plus className="size-5" /></span>
        <span><strong className="block text-lg">新增錯題</strong><small className="mt-1 block leading-5 text-muted-foreground">拍照掃描或手動輸入，再連回主題與節點。</small></span>
      </Link>
    </section>

    <section className="grid divide-y overflow-hidden rounded-2xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Metric icon={Boxes} label="主題數量" value={String(subjects.length)} />
      <Metric icon={CircleDot} label="節點數量" value={String(nodes.length)} />
      <Metric icon={BookOpenCheck} label="錯題數量" value={String(activeQuestions.length)} />
    </section>

    <Dialog open={mapOpen} onOpenChange={setMapOpen}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>選擇要開啟的主題</DialogTitle><DialogDescription>選擇主題後會前往其架構圖清單。</DialogDescription></DialogHeader>
        {subjects.length ? <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">{subjects.map((subject) => {
          const nodeCount = nodes.filter((node) => node.subject_id === subject.id).length;
          return <Link key={subject.id} href={`/outline?subject=${encodeURIComponent(subject.id)}`} onClick={() => setMapOpen(false)} className="group rounded-2xl border bg-background p-4 transition hover:border-primary/40 hover:bg-accent/40">
            <span className="mb-8 block size-3 rounded-full" style={{ backgroundColor: subject.color }} />
            <strong className="block truncate">{subject.name}</strong>
            <span className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{nodeCount} 個節點</span><ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
          </Link>;
        })}</div> : <div className="rounded-2xl border border-dashed p-8 text-center"><p className="font-medium">尚未建立主題</p><Button asChild className="mt-4"><Link href="/outline" onClick={() => setMapOpen(false)}><Plus />建立第一個主題</Link></Button></div>}
      </DialogContent>
    </Dialog>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof BookOpenCheck; label: string; value: string }) { return <div className="flex items-center gap-4 p-4 sm:p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><p className="text-xl font-semibold sm:text-2xl">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div></div>; }
function DashboardSkeleton() { return <div className="space-y-6"><Skeleton className="h-72 rounded-3xl" /><div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-72" /></div>; }
