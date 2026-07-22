import Link from "next/link";
import { BookOpen, Heart, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export const metadata = { title: "錯題庫" };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string; status?: string }> }) {
  const filters = await searchParams;
  const q = (filters.q ?? "").slice(0, 100);
  const supabase = await createClient();
  const { data: subjects } = await supabase.from("subjects").select("*").order("sort_order");
  let query = supabase.from("questions").select("*,subjects(name,color)").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`title.ilike.%${q}%,question_text.ilike.%${q}%,chapter.ilike.%${q}%`);
  if (filters.subject) query = query.eq("subject_id", filters.subject);
  if (filters.status) query = query.eq("status", filters.status as "new" | "learning" | "reviewing" | "mastered" | "archived");
  else query = query.neq("status", "archived");
  const { data: questions } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">錯題庫</h1><p className="mt-2 text-muted-foreground">搜尋題目、章節與狀態，找到下一個需要重做的盲點。</p></div><Button asChild><Link href="/questions/new"><Plus />新增錯題</Link></Button></div>
      <Card><CardContent className="p-4"><form className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input name="q" defaultValue={q} className="pl-9" placeholder="搜尋題目、標題或章節" /></div><select name="subject" defaultValue={filters.subject ?? ""} className="h-9 rounded-md border bg-transparent px-3 text-sm"><option value="">全部科目</option>{subjects?.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><select name="status" defaultValue={filters.status ?? ""} className="h-9 rounded-md border bg-transparent px-3 text-sm"><option value="">進行中</option><option value="new">新題</option><option value="learning">學習中</option><option value="reviewing">複習中</option><option value="mastered">已掌握</option><option value="archived">已封存</option></select><Button type="submit">套用篩選</Button></form></CardContent></Card>
      {!questions?.length ? <div className="rounded-xl border border-dashed p-12 text-center"><BookOpen className="mx-auto size-7 text-muted-foreground" /><p className="mt-4 font-medium">找不到符合條件的錯題</p><p className="mt-2 text-sm text-muted-foreground">調整篩選條件，或新增一題。</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{questions.map((question) => { const subject = Array.isArray(question.subjects) ? question.subjects[0] : question.subjects; return <Link key={question.id} href={`/questions/${question.id}`}><Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/35"><CardContent className="p-5"><div className="flex items-center justify-between"><div className="flex gap-2">{subject?.name && <Badge variant="secondary">{subject.name}</Badge>}<Badge variant="outline">{question.status}</Badge></div>{question.is_favorite && <Heart className="size-4 fill-current text-rose-400" />}</div><h2 className="mt-4 line-clamp-2 font-semibold">{question.title || question.question_text}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{question.question_text}</p><div className="mt-5 flex items-center justify-between text-xs text-muted-foreground"><span>熟練度</span><span className="font-mono text-primary">{question.mastery_score}%</span></div><Progress className="mt-2 h-1.5" value={question.mastery_score} /></CardContent></Card></Link>; })}</div>}
    </div>
  );
}
