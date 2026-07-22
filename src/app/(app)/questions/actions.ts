"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { questionInputSchema, type QuestionInput } from "@/lib/validations/question";

async function authenticated() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) throw new Error("請先登入");
  return { supabase, userId };
}

function nullable(value: string | null) {
  return value?.trim() ? value.trim() : null;
}

function toRow(input: QuestionInput, userId: string) {
  return {
    user_id: userId,
    subject_id: input.subjectId,
    title: nullable(input.title),
    chapter: nullable(input.chapter),
    source: nullable(input.source),
    question_type: nullable(input.questionType),
    difficulty: input.difficulty,
    question_text: input.questionText,
    original_answer: nullable(input.originalAnswer),
    correct_answer: nullable(input.correctAnswer),
    solution_text: nullable(input.solutionText),
    key_concepts: input.keyConcepts,
    error_types: input.errorTypes,
    error_note: nullable(input.errorNote),
    memory_tip: nullable(input.memoryTip),
    is_ai_generated: input.isAiGenerated,
  };
}

export async function createQuestionAction(input: QuestionInput) {
  const parsed = questionInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "資料格式錯誤" };

  try {
    const { supabase, userId } = await authenticated();
    const { data, error } = await supabase.from("questions").insert(toRow(parsed.data, userId)).select("id").single();
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    revalidatePath("/questions");
    return { id: data.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "儲存失敗" };
  }
}

export async function updateQuestionAction(id: string, input: QuestionInput) {
  const parsed = questionInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "資料格式錯誤" };

  try {
    const { supabase, userId } = await authenticated();
    const row = toRow(parsed.data, userId);
    const { error } = await supabase.from("questions").update(row).eq("id", id).eq("user_id", userId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    revalidatePath("/questions");
    revalidatePath(`/questions/${id}`);
    return { id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "更新失敗" };
  }
}

export async function deleteQuestionAction(id: string) {
  try {
    const { supabase, userId } = await authenticated();
    const { error } = await supabase.from("questions").delete().eq("id", id).eq("user_id", userId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    revalidatePath("/questions");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "刪除失敗" };
  }
}

export async function toggleFavoriteAction(id: string, value: boolean) {
  const { supabase, userId } = await authenticated();
  const { error } = await supabase.from("questions").update({ is_favorite: value }).eq("id", id).eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/questions");
  revalidatePath(`/questions/${id}`);
  return { success: true };
}
