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
    answer_config: input.answerConfig,
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

async function ensureOutlineNode(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, subjectId: string | null, chapter: string | null) {
  if (!subjectId || !chapter?.trim()) return null;
  // The generated Supabase types predate the outline_nodes migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data } = await db.from("outline_nodes").upsert({ user_id: userId, subject_id: subjectId, name: chapter.trim() }, { onConflict: "user_id,subject_id,name" }).select("id").single();
  return data?.id ?? null;
}

export async function createQuestionAction(input: QuestionInput) {
  const parsed = questionInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "資料格式錯誤" };

  try {
    const { supabase, userId } = await authenticated();
    const nodeId = await ensureOutlineNode(supabase, userId, parsed.data.subjectId, parsed.data.chapter);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("questions").insert({ ...toRow(parsed.data, userId), node_id: nodeId }).select("id").single();
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
    const nodeId = await ensureOutlineNode(supabase, userId, parsed.data.subjectId, parsed.data.chapter);
    const row = { ...toRow(parsed.data, userId), node_id: nodeId };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("questions").update(row).eq("id", id).eq("user_id", userId);
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

export async function applyQuestionAssignmentsAction(assignments: Array<{ id: string; subjectId: string; chapter: string }>) {
  if (assignments.length > 20) return { error: "一次最多整理 20 題。" };
  try {
    const { supabase, userId } = await authenticated();
    for (const assignment of assignments) {
      if (!assignment.id || !assignment.subjectId || !assignment.chapter.trim()) continue;
      const nodeId = await ensureOutlineNode(supabase, userId, assignment.subjectId, assignment.chapter);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("questions").update({ subject_id: assignment.subjectId, chapter: assignment.chapter.trim(), node_id: nodeId }).eq("id", assignment.id).eq("user_id", userId);
      if (error) return { error: error.message };
    }
    revalidatePath("/questions");
    revalidatePath("/outline");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "套用歸類失敗" };
  }
}
