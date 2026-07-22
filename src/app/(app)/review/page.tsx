import { createClient } from "@/lib/supabase/server";
import { ReviewSession } from "@/components/review/review-session";

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
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">今日複習</h1><p className="mt-2 text-muted-foreground">先作答、再看解答；誠實評分比追求連勝更有價值。</p></div><ReviewSession initialQuestions={questions} /></div>;
}
