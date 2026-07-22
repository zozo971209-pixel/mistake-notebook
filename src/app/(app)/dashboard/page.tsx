import Link from "next/link";
import { ArrowRight, BookOpen, Brain, CheckCircle2, Clock3, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const metadata = { title: "學習總覽" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const currentDate = new Date();
  const now = currentDate.toISOString();
  const weekStartDate = new Date(currentDate);
  weekStartDate.setDate(weekStartDate.getDate() - 7);
  const startOfWeek = weekStartDate.toISOString();
  const [{ data: questions }, { count: dueCount }, { data: recentReviews }, { data: settings }] = await Promise.all([
    supabase.from("questions").select("id,title,question_text,mastery_score,status,created_at,subjects(name,color)").neq("status", "archived").order("created_at", { ascending: false }).limit(5),
    supabase.from("questions").select("*", { count: "exact", head: true }).lte("next_review_at", now).neq("status", "archived"),
    supabase.from("review_records").select("result").gte("reviewed_at", startOfWeek),
    supabase.from("user_settings").select("daily_review_target").single(),
  ]);

  const reviews = recentReviews ?? [];
  const correct = reviews.filter((item) => item.result === "correct" || item.result === "easy").length;
  const accuracy = reviews.length ? Math.round((correct / reviews.length) * 100) : 0;
  const mastered = questions?.filter((item) => item.status === "mastered").length ?? 0;
  const dailyTarget = settings?.daily_review_target ?? 20;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm text-primary">今天也讓一個盲點變清楚</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">學習總覽</h1><p className="mt-2 text-muted-foreground">先處理到期錯題，再新增今天的發現。</p></div>
        <Button asChild><Link href="/questions/new"><Plus />新增錯題</Link></Button>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Clock3} label="今日待複習" value={String(dueCount ?? 0)} note={`每日目標 ${dailyTarget} 題`} />
        <Metric icon={CheckCircle2} label="近七日正確率" value={`${accuracy}%`} note={`${reviews.length} 次作答`} />
        <Metric icon={Brain} label="最近五題已掌握" value={String(mastered)} note="熟練度達 90" />
        <Metric icon={BookOpen} label="最近新增" value={String(questions?.length ?? 0)} note="顯示最新五題" />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>最近錯題</CardTitle><CardDescription>回到剛建立的內容，補上錯因與解法。</CardDescription></div><Button asChild variant="ghost"><Link href="/questions">全部題目<ArrowRight /></Link></Button></CardHeader>
          <CardContent className="space-y-3">
            {!questions?.length && <Empty title="題庫還是空的" text="先新增第一題；即使沒有 AI，也能完整使用題庫與複習功能。" />}
            {questions?.map((question) => {
              const subject = Array.isArray(question.subjects) ? question.subjects[0] : question.subjects;
              return <Link key={question.id} href={`/questions/${question.id}`} className="block rounded-xl border p-4 transition hover:border-primary/35 hover:bg-accent/30"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2">{subject?.name && <Badge variant="secondary">{subject.name}</Badge>}<span className="text-xs text-muted-foreground">{question.status}</span></div><p className="mt-2 line-clamp-2 font-medium">{question.title || question.question_text}</p></div><span className="font-mono text-sm text-primary">{question.mastery_score}%</span></div><Progress className="mt-3 h-1.5" value={question.mastery_score} /></Link>;
            })}
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader><CardTitle>今日複習</CardTitle><CardDescription>系統會優先顯示已到期與熟練度較低的題目。</CardDescription></CardHeader>
          <CardContent>
            <div className="text-5xl font-semibold">{dueCount ?? 0}</div><p className="mt-2 text-sm text-muted-foreground">題等待你重新作答</p><Progress className="mt-6" value={Math.min(100, ((dueCount ?? 0) / dailyTarget) * 100)} /><Button asChild className="mt-6 w-full"><Link href="/review">開始複習<ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof Clock3; label: string; value: string; note: string }) {
  return <Card><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><Icon className="size-4 text-primary" /></div><p className="mt-3 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent></Card>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-dashed p-8 text-center"><p className="font-medium">{title}</p><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p><Button asChild className="mt-4"><Link href="/questions/new">新增第一題</Link></Button></div>;
}
