import { createClient } from "@/lib/supabase/server";
import { ReviewSession } from "@/components/review/review-session";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "今日複習" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ question?: string }> }) {
  const { question } = await searchParams;
  const supabase = await createClient();
  const { data: settings } = await supabase.from("user_settings").select("daily_review_target").single();
  const limit = settings?.daily_review_target ?? 20;
  let query = supabase.from("questions").select("*,subjects(name,color)").neq("status", "archived");
  if (question) query = query.eq("id", question);
  else query = query.lte("next_review_at", new Date().toISOString()).order("mastery_score").limit(limit);
  let { data } = await query;
  if (!question && !data?.length) {
    const fallback = await supabase.from("questions").select("*,subjects(name,color)").neq("status", "archived").order("mastery_score").limit(Math.min(10, limit));
    data = fallback.data;
  }
  const questions = (data ?? []).map((item) => ({ ...item, subjects: Array.isArray(item.subjects) ? item.subjects[0] ?? null : item.subjects }));
  return <div className="space-y-6"><PageHeader title="複習" description="先獨立作答，再揭曉答案。" /><ReviewSession initialQuestions={questions} /></div>;
}
