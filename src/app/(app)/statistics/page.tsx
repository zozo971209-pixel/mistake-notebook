import { BarChart3, Brain, CheckCircle2, Flame, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "學習分析" };

export default async function StatisticsPage() {
  const supabase = await createClient();
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 30);
  const since = sinceDate.toISOString();
  const [{ data: questions }, { data: reviews }] = await Promise.all([
    supabase.from("questions").select("mastery_score,status,error_types,subjects(name,color)").neq("status", "archived"),
    supabase.from("review_records").select("result,reviewed_at").gte("reviewed_at", since).order("reviewed_at"),
  ]);
  const qs = questions ?? [];
  const rs = reviews ?? [];
  const correct = rs.filter((review) => review.result === "correct" || review.result === "easy").length;
  const accuracy = rs.length ? Math.round((correct / rs.length) * 100) : 0;
  const average = qs.length ? Math.round(qs.reduce((sum, question) => sum + question.mastery_score, 0) / qs.length) : 0;
  const mastered = qs.filter((question) => question.status === "mastered").length;

  const subjectCounts = new Map<string, { count: number; color: string }>();
  const errorCounts = new Map<string, number>();
  for (const question of qs) {
    const subject = Array.isArray(question.subjects) ? question.subjects[0] : question.subjects;
    const key = subject?.name ?? "未分類";
    const current = subjectCounts.get(key) ?? { count: 0, color: subject?.color ?? "#8b5cf6" };
    current.count += 1;
    subjectCounts.set(key, current);
    question.error_types.forEach((type) => errorCounts.set(type, (errorCounts.get(type) ?? 0) + 1));
  }
  const subjects = [...subjectCounts.entries()].sort((a, b) => b[1].count - a[1].count);
  const errors = [...errorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxSubject = Math.max(1, ...subjects.map(([, value]) => value.count));
  const maxError = Math.max(1, ...errors.map(([, value]) => value));

  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl font-semibold tracking-tight">學習分析</h1><p className="mt-2 text-muted-foreground">用錯因和熟練度判斷下一步，不只看總分。</p></div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Target} label="題庫總數" value={String(qs.length)} />
        <Metric icon={CheckCircle2} label="近 30 日正確率" value={`${accuracy}%`} />
        <Metric icon={Brain} label="平均熟練度" value={`${average}%`} />
        <Metric icon={Flame} label="已掌握" value={String(mastered)} />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>科目分布</CardTitle><CardDescription>錯題較多不一定代表較弱，也可能代表投入較多；要搭配正確率判讀。</CardDescription></CardHeader><CardContent className="space-y-4">{!subjects.length && <Empty />}{subjects.map(([name, value]) => <Bar key={name} label={name} value={value.count} max={maxSubject} color={value.color} />)}</CardContent></Card>
        <Card><CardHeader><CardTitle>最常見錯因</CardTitle><CardDescription>優先處理高頻錯因，通常比盲目多刷題更有效。</CardDescription></CardHeader><CardContent className="space-y-4">{!errors.length && <Empty />}{errors.map(([name, value]) => <Bar key={name} label={name} value={value} max={maxError} color="#a78bfa" />)}</CardContent></Card>
      </section>
      <Card><CardHeader><CardTitle>閱讀這份數據的方法</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-3"><Insight title="先看錯因">若「題意理解錯誤」遠高於「公式記錯」，下一週應增加題意轉換與條件標註，而不是只背公式。</Insight><Insight title="再看熟練度">平均熟練度上升但正確率下降，可能是近期加入了較難的新題，未必代表退步。</Insight><Insight title="保留不確定性">AI 推測的錯因一定要由你確認。相同錯答可能來自概念、計算、時間或抄寫問題。</Insight></CardContent></Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return <Card><CardContent className="p-5"><Icon className="size-5 text-primary" /><p className="mt-4 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p></CardContent></Card>;
}
function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return <div><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="font-mono text-muted-foreground">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(4, (value / max) * 100)}%`, backgroundColor: color }} /></div></div>;
}
function Empty() { return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">累積題目與複習紀錄後，這裡會顯示分析。</p>; }
function Insight({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-lg border p-4"><p className="font-medium text-foreground">{title}</p><p className="mt-2 leading-6">{children}</p></div>; }
