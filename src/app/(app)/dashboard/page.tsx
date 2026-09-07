"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpenCheck, CheckCircle2, Database, Map as MapIcon, Plus, RotateCcw } from "lucide-react";
import { useLocalData } from "@/lib/local-data/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { ready, error, questions, reviews, subjects, settings } = useLocalData();
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

  return <div className="space-y-8">
    <section className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.10] via-card to-card p-6 sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_280px]"><div><p className="text-sm font-medium text-primary">本機學習工作區</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">把錯題放回知識脈絡</h1><p className="mt-3 max-w-xl text-muted-foreground">建立自己的科目架構，將每一道錯題連到節點，再按熟練度持續重作。</p><div className="mt-6 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/outline"><MapIcon />整理學習地圖</Link></Button><Button asChild size="lg" variant="outline"><Link href="/questions/new"><Plus />新增錯題</Link></Button>{active.length > 0 && <Button asChild size="lg" variant="ghost"><Link href="/review"><RotateCcw />開始複習</Link></Button>}</div></div><div className="rounded-2xl bg-background/60 p-5 text-center"><div className="mx-auto flex size-28 items-center justify-center rounded-full border-[10px] border-primary/20 text-3xl font-semibold text-primary">{Math.min(due.length, settings.daily_review_target)}<span className="ml-1 text-sm text-muted-foreground">/{settings.daily_review_target}</span></div><p className="mt-4 text-sm text-muted-foreground">今日待複習</p></div></div>
    </section>
    <section className="grid divide-y rounded-2xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0"><Metric icon={BookOpenCheck} label="錯題總數" value={String(active.length)} /><Metric icon={CheckCircle2} label="近七日正確率" value={`${accuracy}%`} /><Metric icon={Database} label="資料位置" value="此裝置" /></section>
    <section className="grid gap-8 lg:grid-cols-[1fr_320px]"><div><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">最近錯題</h2><Button asChild variant="ghost" size="sm"><Link href="/questions">查看全部<ArrowRight /></Link></Button></div><div className="divide-y overflow-hidden rounded-2xl border bg-card">{recent.length === 0 && <div className="p-10 text-center"><p className="font-medium">還沒有錯題</p><p className="mt-1 text-sm text-muted-foreground">先新增一題，學習進度會從這裡開始。</p></div>}{recent.map((question) => { const subject = subjects.find((item) => item.id === question.subject_id); return <Link key={question.id} href={`/question?id=${encodeURIComponent(question.id)}`} className="flex items-center gap-4 p-4 transition hover:bg-accent/55"><span className="h-10 w-1 rounded-full" style={{ backgroundColor: subject?.color ?? "#4f46e5" }} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2">{subject && <Badge variant="secondary">{subject.name}</Badge>}<span className="truncate text-sm font-medium">{question.title || question.question_text}</span></div><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{question.chapter || "尚未連結節點"}</p></div><span className="font-mono text-sm text-primary">{question.mastery_score}%</span></Link>; })}</div></div><div><h2 className="mb-4 text-lg font-semibold">優先加強</h2><Card><CardContent className="space-y-5 p-5">{subjectScores.length === 0 && <p className="text-sm text-muted-foreground">加入錯題後，這裡會顯示較弱科目。</p>}{subjectScores.map((subject) => <div key={subject.id}><div className="mb-2 flex justify-between text-sm"><span>{subject.name}</span><span className="font-mono text-muted-foreground">{subject.score}%</span></div><Progress value={subject.score} /></div>)}</CardContent></Card></div></section>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof BookOpenCheck; label: string; value: string }) { return <div className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div></div>; }
function DashboardSkeleton() { return <div className="space-y-6"><Skeleton className="h-72 rounded-3xl" /><div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-72" /></div>; }
