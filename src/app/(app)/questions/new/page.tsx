import { createClient } from "@/lib/supabase/server";
import { QuestionForm } from "@/components/questions/question-form";

export const metadata = { title: "新增錯題" };

export default async function NewQuestionPage() {
  const supabase = await createClient();
  const { data: subjects } = await supabase.from("subjects").select("*").order("sort_order");
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">新增錯題</h1><p className="mt-2 text-sm text-muted-foreground">用最快的方式留下題目與錯因。</p></div><QuestionForm subjects={subjects ?? []} /></div>;
}
