"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ReviewResult = Database["public"]["Enums"]["review_result"];

export async function recordReviewAction(input: {
  questionId: string;
  result: ReviewResult;
  answer: string;
  usedHint: boolean;
  durationSeconds: number;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "請先登入" };
  const { data: updated, error } = await supabase.rpc("record_review", {
    target_question_id: input.questionId,
    review_outcome: input.result,
    answer_text: input.answer || undefined,
    hint_used: input.usedHint,
    elapsed_seconds: Math.max(0, Math.min(86400, Math.round(input.durationSeconds))),
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/review");
  revalidatePath(`/questions/${input.questionId}`);
  return { data: updated };
}
