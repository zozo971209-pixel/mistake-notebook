import { createClient } from "@/lib/supabase/server";
import { QuestionForm } from "@/components/questions/question-form";

export const metadata = { title: "新增錯題" };

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<{ subject?: string; chapter?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: subjects } = await supabase.from("subjects").select("*").order("sort_order");
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">CAPTURE → REVIEW</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">新增錯題</h1><p className="mt-2 text-sm text-muted-foreground">先留下題目，再在複習時找出真正的錯因。</p></div><QuestionForm subjects={subjects ?? []} defaultSubjectId={params.subject ?? ""} defaultChapter={params.chapter ?? ""} /></div>;
}
