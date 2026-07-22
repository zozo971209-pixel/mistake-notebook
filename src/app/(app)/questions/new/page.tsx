import { createClient } from "@/lib/supabase/server";
import { QuestionForm } from "@/components/questions/question-form";

export const metadata = { title: "新增錯題" };

export default async function NewQuestionPage() {
  const supabase = await createClient();
  const { data: subjects } = await supabase.from("subjects").select("*").order("sort_order");
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">新增錯題</h1><p className="mt-2 text-muted-foreground">預設只掃描、不保存照片；確認文字正確後才會寫入題庫。</p></div><QuestionForm subjects={subjects ?? []} /></div>;
}
