import Link from "next/link";
import { BookOpen, Filter, Heart, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { QuestionBankAI } from "@/components/questions/question-bank-ai";

export const metadata = { title: "題庫" };
const statusLabels: Record<string, string> = { new: "新題", learning: "學習中", reviewing: "複習中", mastered: "已掌握", archived: "已封存" };

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
      <PageHeader eyebrow="CAPTURE & REVIEW" title="錯題庫" description="每一題都連回它所屬的科目與節點，讓複習有方向。" action={<Button asChild className="hidden sm:inline-flex"><Link href="/questions/new"><Plus />新增錯題</Link></Button>} />
      <QuestionBankAI questions={(questions ?? []) as Array<{ id: string; title: string | null; question_text: string; subject_id: string | null; chapter: string | null }>} subjects={(subjects ?? []).map((subject) => ({ id: subject.id, name: subject.name }))} />
      <form className="space-y-3"><div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input name="q" defaultValue={q} className="pl-9" placeholder="搜尋題目或章節" /></div><Button type="submit" variant="outline"><Search />搜尋</Button></div><div className="flex flex-wrap gap-2">{[["", "全部"], ["new", "新題"], ["learning", "學習中"], ["reviewing", "待複習"], ["mastered", "已掌握"]].map(([value, label]) => <Button key={label} asChild size="sm" variant={(filters.status ?? "") === value ? "default" : "outline"}><Link href={`/questions?${new URLSearchParams({ ...(q ? { q } : {}), ...(value ? { status: value } : {}) })}`}>{label}</Link></Button>)}<details className="relative"><summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md border px-3 text-xs"><Filter className="size-3" />科目</summary><div className="absolute right-0 z-10 mt-2 grid w-48 gap-1 rounded-xl border bg-popover p-2 shadow-xl">{subjects?.map((subject) => <Link key={subject.id} href={`/questions?${new URLSearchParams({ ...(q ? { q } : {}), subject: subject.id })}`} className="rounded-lg px-3 py-2 text-sm hover:bg-accent">{subject.name}</Link>)}</div></details></div></form>
      {!questions?.length ? <div className="rounded-2xl border border-dashed p-12 text-center"><BookOpen className="mx-auto size-8 text-muted-foreground" /><p className="mt-4 font-medium">找不到符合條件的錯題</p><p className="mt-2 text-sm text-muted-foreground">調整篩選，或新增一題。</p></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{questions.map((question) => { const subject = Array.isArray(question.subjects) ? question.subjects[0] : question.subjects; const due = new Date(question.next_review_at) <= new Date(); return <Link key={question.id} href={`/questions/${question.id}`} className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-[0_8px_24px_rgb(24_32_51_/_0.04)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_30px_rgb(55_48_163_/_0.09)]"><span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: subject?.color ?? "#4f46e5" }} /><div className="flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2">{subject?.name && <Badge variant="secondary">{subject.name}</Badge>}<Badge variant="outline">{statusLabels[question.status] ?? question.status}</Badge>{due && question.status !== "mastered" && <span className="mt-1 size-2 rounded-full bg-amber-500" title="已到複習時間" />}</div>{question.is_favorite && <Heart className="size-4 fill-current text-rose-500" />}</div><h2 className="mt-4 line-clamp-2 font-semibold leading-6">{question.title || question.question_text}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{question.question_text}</p><div className="mt-5 flex items-center justify-between text-xs text-muted-foreground"><span>熟練度</span><span className="font-mono text-primary">{question.mastery_score}%</span></div><Progress className="mt-2 h-1.5" value={question.mastery_score} /></Link>; })}</div>}
    </div>
  );
}
