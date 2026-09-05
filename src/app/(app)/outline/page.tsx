import { Map as MapIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { OutlineView } from "@/components/outline/outline-view";

export const metadata = { title: "學習地圖" };

export default async function OutlinePage() {
  const supabase = await createClient();
  const [{ data: subjects }, { data: questions }, { data: nodes }] = await Promise.all([
    supabase.from("subjects").select("id,name,color,sort_order").order("sort_order"),
    supabase.from("questions").select("id,title,question_text,mastery_score,status,subject_id,chapter").neq("status", "archived").order("created_at", { ascending: false }),
    // The generated Supabase types predate the outline_nodes migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("outline_nodes").select("id,subject_id,name,sort_order").order("sort_order"),
  ]);
  const outline = (subjects ?? []).map((subject) => {
    const related = (questions ?? []).filter((question) => question.subject_id === subject.id);
    const groups = new Map<string, typeof related>();
    for (const node of (nodes ?? []).filter((item: { subject_id: string }) => item.subject_id === subject.id)) groups.set(node.name, []);
    for (const question of related) {
      const chapter = question.chapter?.trim() || "未分類節點";
      groups.set(chapter, [...(groups.get(chapter) ?? []), question]);
    }
    return { ...subject, chapters: [...groups.entries()].map(([name, chapterQuestions]) => ({ name, questions: chapterQuestions })) };
  });
  return <div className="space-y-6"><PageHeader eyebrow="WORKSPACE" title="學習地圖" description="自由整理科目與節點；新增錯題時指定章節，題目就會自動連動到這裡。" action={<MapIcon className="hidden size-8 text-primary/50 sm:block" />} /><OutlineView subjects={outline} /></div>;
}
