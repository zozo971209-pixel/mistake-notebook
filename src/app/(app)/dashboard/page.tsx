import Link from "next/link";
import { ArrowRight, BookOpenCheck, CheckCircle2, Clock3, Map as MapIcon, Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const metadata = { title: "首頁" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const currentDate = new Date();
  const now = currentDate.toISOString();
  const weekStartDate = new Date(currentDate);
  weekStartDate.setDate(weekStartDate.getDate() - 7);
  const [{ data: recent }, { data: allQuestions }, { count: dueCount }, { data: reviews }, { data: settings }] = await Promise.all([
    supabase.from("questions").select("id,title,question_text,mastery_score,status,subjects(name,color)").neq("status", "archived").order("created_at", { ascending: false }).limit(4),
    supabase.from("questions").select("mastery_score,status,subjects(name,color)").neq("status", "archived"),
    supabase.from("questions").select("*", { count: "exact", head: true }).lte("next_review_at", now).neq("status", "archived"),
    supabase.from("review_records").select("result,reviewed_at").gte("reviewed_at", weekStartDate.toISOString()),
    supabase.from("user_settings").select("daily_review_target").single(),
  ]);
  const weeklyReviews = reviews ?? [];
  const correct = weeklyReviews.filter((item) => item.result === "correct" || item.result === "easy").length;
  const accuracy = weeklyReviews.length ? Math.round((correct / weeklyReviews.length) * 100) : 0;
  const mastered = allQuestions?.filter((item) => item.status === "mastered").length ?? 0;
  const target = settings?.daily_review_target ?? 20;
  const subjectScores = new Map<string, { total: number; count: number; color: string }>();
  for (const question of allQuestions ?? []) {
    const subject = Array.isArray(question.subjects) ? question.subjects[0] : question.subjects;
    const name = subject?.name ?? "未分類";
    const value = subjectScores.get(name) ?? { total: 0, count: 0, color: subject?.color ?? "#8b5cf6" };
    value.total += question.mastery_score;
    value.count += 1;
    subjectScores.set(name, value);
  }
  const weakSubjects = [...subjectScores.entries()].map(([name, value]) => ({ name, score: Math.round(value.total / value.count), color: value.color })).sort((a, b) => a.score - b.score).slice(0, 4);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.10] via-card to-card p-6 shadow-[0_18px_50px_rgb(24_32_51_/_0.05)] sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_280px]">
          <div><p className="text-sm font-medium text-primary">今日工作區</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">還有 {dueCount ?? 0} 題等待複習</h1><p className="mt-3 max-w-xl text-muted-foreground">先完成到期題目，再把新的錯誤放回正確的學習節點。</p><div className="mt-6 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/review">開始今日複習<ArrowRight /></Link></Button><Button asChild size="lg" variant="outline"><Link href="/questions/new"><Plus />新增錯題</Link></Button><Button asChild size="lg" variant="ghost"><Link href="/outline"><MapIcon />查看學習地圖</Link></Button></div></div>
          <div className="rounded-2xl bg-background/60 p-5 text-center"><div className="mx-auto flex size-28 items-center justify-center rounded-full border-[10px] border-primary/20 text-3xl font-semibold text-primary">{Math.min(dueCount ?? 0, target)}<span className="ml-1 text-sm text-muted-foreground">/{target}</span></div><p className="mt-4 text-sm text-muted-foreground">今日複習目標</p></div>
        </div>
      </section>

      <section className="grid divide-y rounded-2xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Metric icon={CheckCircle2} label="近七日正確率" value={`${accuracy}%`} note={`${weeklyReviews.length} 次作答`} />
        <Metric icon={Sparkles} label="已掌握" value={String(mastered)} note="熟練度持續累積" />
        <Metric icon={BookOpenCheck} label="題庫總數" value={String(allQuestions?.length ?? 0)} note="不含已封存題目" />
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">最近錯題</h2><Button asChild variant="ghost" size="sm"><Link href="/questions">查看全部<ArrowRight /></Link></Button></div><div className="divide-y overflow-hidden rounded-2xl border bg-card">{!recent?.length && <Empty />}{recent?.map((question) => { const subject = Array.isArray(question.subjects) ? question.subjects[0] : question.subjects; return <Link key={question.id} href={`/questions/${question.id}`} className="flex items-center gap-4 p-4 transition hover:bg-accent/55"><span className="h-10 w-1 rounded-full" style={{ backgroundColor: subject?.color ?? "#4f46e5" }} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2">{subject?.name && <Badge variant="secondary">{subject.name}</Badge>}<span className="truncate text-sm font-medium">{question.title || question.question_text}</span></div><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{question.question_text}</p></div><span className="font-mono text-sm text-primary">{question.mastery_score}%</span></Link>; })}</div></div>
        <div><h2 className="mb-4 text-lg font-semibold">優先加強</h2><Card><CardContent className="space-y-5 p-5">{!weakSubjects.length && <p className="text-sm text-muted-foreground">加入錯題後，這裡會顯示較弱科目。</p>}{weakSubjects.map((subject) => <div key={subject.name}><div className="mb-2 flex justify-between text-sm"><span>{subject.name}</span><span className="font-mono text-muted-foreground">{subject.score}%</span></div><Progress value={subject.score} style={{ "--progress-color": subject.color } as React.CSSProperties} /></div>)}</CardContent></Card></div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof Clock3; label: string; value: string; note: string }) {
  return <div className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><p className="text-2xl font-semibold">{value}</p><p className="text-sm">{label}</p><p className="text-xs text-muted-foreground">{note}</p></div></div>;
}
function Empty() { return <div className="p-8 text-center"><p className="font-medium">題庫還是空的</p><p className="mt-1 text-sm text-muted-foreground">新增第一題後，學習進度會出現在這裡。</p></div>; }
