"use client";

import { CheckCircle2, Flame, Target } from "lucide-react";
import { useState } from "react";
import { useLocalData } from "@/lib/local-data/provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatisticsPage() {
  const { ready, questions, reviews, subjects } = useLocalData();
  const [currentTime] = useState(() => Date.now());
  if (!ready) return <p className="text-sm text-muted-foreground">正在整理學習紀錄…</p>;
  const qs = questions.filter((item) => item.status !== "archived");
  const rs = reviews.filter((item) => currentTime - Date.parse(item.reviewed_at) <= 30 * 86400000);
  const correct = rs.filter((item) => item.result === "correct" || item.result === "easy").length;
  const accuracy = rs.length ? Math.round(correct / rs.length * 100) : 0;
  const average = qs.length ? Math.round(qs.reduce((sum, item) => sum + item.mastery_score, 0) / qs.length) : 0;
  const scores = subjects.map((subject) => { const related = qs.filter((item) => item.subject_id === subject.id); return { ...subject, count: related.length, score: related.length ? Math.round(related.reduce((sum, item) => sum + item.mastery_score, 0) / related.length) : 0 }; }).filter((item) => item.count);
  const counts = new Map<string, number>(); qs.forEach((item) => item.error_types.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1)));
  const errors = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6); const max = Math.max(1, ...errors.map(([, value]) => value));
  return <div className="space-y-8"><PageHeader title="學習分析" description="所有統計都直接由此裝置的資料計算。" /><section className="grid divide-y rounded-2xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0"><Metric icon={CheckCircle2} label="近 30 日正確率" value={`${accuracy}%`} /><Metric icon={Target} label="平均熟練度" value={`${average}%`} /><Metric icon={Flame} label="已掌握" value={String(qs.filter((item) => item.status === "mastered").length)} /></section><section className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>科目掌握度</CardTitle></CardHeader><CardContent className="space-y-5">{scores.length === 0 && <Empty />}{scores.map((item) => <Bar key={item.id} label={item.name} value={item.score} max={100} color={item.color} suffix="%" />)}</CardContent></Card><Card><CardHeader><CardTitle>常見錯因</CardTitle></CardHeader><CardContent className="space-y-5">{errors.length === 0 && <Empty />}{errors.map(([name, value]) => <Bar key={name} label={name} value={value} max={max} color="#7c3aed" />)}</CardContent></Card></section></div>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) { return <div className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div></div>; }
function Bar({ label, value, max, color, suffix = "" }: { label: string; value: number; max: number; color: string; suffix?: string }) { return <div><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="font-mono text-muted-foreground">{value}{suffix}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(4, value / max * 100)}%`, backgroundColor: color }} /></div></div>; }
function Empty() { return <p className="py-8 text-center text-sm text-muted-foreground">累積題目與複習紀錄後，這裡會顯示分析。</p>; }
