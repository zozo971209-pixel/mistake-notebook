import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuestionForm } from "@/components/questions/question-form";

export const metadata = { title: "編輯錯題" };

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: question }, { data: subjects }] = await Promise.all([
    supabase.from("questions").select("*").eq("id", id).single(),
    supabase.from("subjects").select("*").order("sort_order"),
  ]);
  if (!question) notFound();
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">編輯錯題</h1><p className="mt-2 text-sm text-muted-foreground">修正題目、答案與錯因。</p></div><QuestionForm subjects={subjects ?? []} initial={question} /></div>;
}
