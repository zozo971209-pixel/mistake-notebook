import { CheckCircle2, Flame, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "分析" };

export default async function StatisticsPage() {
  const supabase = await createClient();
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 30);
  const [{ data: questions }, { data: reviews }] = await Promise.all([
    supabase.from("questions").select("mastery_score,status,error_types,subjects(name,color)").neq("status", "archived"),
    supabase.from("review_records").select("result,reviewed_at").gte("reviewed_at", sinceDate.toISOString()).order("reviewed_at"),
  ]);
  const qs = questions ?? [];
  const rs = reviews ?? [];
  const correct = rs.filter((review) => review.result === "correct" || review.result === "easy").length;
  const accuracy = rs.length ? Math.round((correct / rs.length) * 100) : 0;
  const average = qs.length ? Math.round(qs.reduce((sum, question) => sum + question.mastery_score, 0) / qs.length) : 0;
  const mastered = qs.filter((question) => question.status === "mastered").length;
  const subjectScores = new Map<string, { total: number; count: number; color: string }>();
  const errorCounts = new Map<string, number>();
  for (const question of qs) {
    const subject = Array.isArray(question.subjects) ? question.subjects[0] : question.subjects;
    const name = subject?.name ?? "未分類";
    const value = subjectScores.get(name) ?? { total: 0, count: 0, color: subject?.color ?? "#8b5cf6" };
    value.total += question.mastery_score; value.count += 1; subjectScores.set(name, value);
    question.error_types.forEach((type) => errorCounts.set(type, (errorCounts.get(type) ?? 0) + 1));
  }
  const subjects = [...subjectScores.entries()].map(([name, value]) => ({ name, score: Math.round(value.total / value.count), color: value.color })).sort((a, b) => a.score - b.score);
  const errors = [...errorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxError = Math.max(1, ...errors.map(([, value]) => value));
  const reviewDays = new Map<string, number>();
  rs.forEach((review) => { const key = review.reviewed_at.slice(0, 10); reviewDays.set(key, (reviewDays.get(key) ?? 0) + 1); });
  const days = Array.from({ length: 21 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (20 - index)); const key = date.toISOString().slice(0, 10); return { key, count: reviewDays.get(key) ?? 0, label: `${date.getMonth() + 1}/${date.getDate()}` }; });

  return <div className="space-y-8"><PageHeader title="學習分析" description="看見進步，也找到下一個需要加強的地方。" />
    <section className="grid divide-y rounded-2xl border bg-card/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0"><Metric icon={CheckCircle2} label="近 30 日正確率" value={`${accuracy}%`} /><Metric icon={Target} label="平均熟練度" value={`${average}%`} /><Metric icon={Flame} label="已掌握" value={String(mastered)} /></section>
    <Card><CardHeader><CardTitle>近 21 日複習</CardTitle></CardHeader><CardContent><div className="grid grid-cols-7 gap-2">{days.map((day) => <div key={day.key} title={`${day.label}：${day.count} 次`} className="aspect-square rounded-md border" style={{ backgroundColor: day.count ? `oklch(0.72 0.16 285 / ${Math.min(0.2 + day.count * 0.12, 0.9)})` : undefined }} />)}</div><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{days[0]?.label}</span><span>今天</span></div></CardContent></Card>
    <section className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>科目掌握度</CardTitle></CardHeader><CardContent className="space-y-5">{!subjects.length && <Empty />}{subjects.map((subject) => <Bar key={subject.name} label={subject.name} value={subject.score} max={100} color={subject.color} suffix="%" />)}</CardContent></Card><Card><CardHeader><CardTitle>常見錯因</CardTitle></CardHeader><CardContent className="space-y-5">{!errors.length && <Empty />}{errors.map(([name, value]) => <Bar key={name} label={name} value={value} max={maxError} color="#a78bfa" />)}</CardContent></Card></section>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) { return <div className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><p className="text-2xl font-semibold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div></div>; }
function Bar({ label, value, max, color, suffix = "" }: { label: string; value: number; max: number; color: string; suffix?: string }) { return <div><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="font-mono text-muted-foreground">{value}{suffix}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(4, value / max * 100)}%`, backgroundColor: color }} /></div></div>; }
function Empty() { return <p className="py-8 text-center text-sm text-muted-foreground">累積題目與複習紀錄後，這裡會顯示分析。</p>; }
