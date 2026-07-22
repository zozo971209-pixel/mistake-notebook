import { NextResponse } from "next/server";
import { z } from "zod";
import { friendlyGeminiError, tutorQuestion } from "@/lib/ai/gemini";
import { prepareAiRequest } from "@/lib/ai/request";

const inputSchema = z.object({
  questionId: z.string().uuid(),
  conversationId: z.string().uuid().nullable().optional(),
  mode: z.enum(["tutor", "hint", "socratic", "explain", "diagnose", "similar"]),
  message: z.string().trim().min(1).max(4000),
});

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: Request) {
  const auth = await prepareAiRequest(request, "tutor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "問題格式不正確。" }, { status: 400 });

  const { data: question } = await auth.supabase.from("questions").select("*").eq("id", parsed.data.questionId).single();
  if (!question) return NextResponse.json({ error: "找不到題目。" }, { status: 404 });

  let conversationId = parsed.data.conversationId ?? null;
  if (!conversationId) {
    const { data: conversation, error } = await auth.supabase.from("ai_conversations").insert({ user_id: auth.userId, question_id: question.id, title: question.title || "題目討論", mode: parsed.data.mode }).select("id").single();
    if (error) return NextResponse.json({ error: "無法建立對話。" }, { status: 500 });
    conversationId = conversation.id;
  }

  await auth.supabase.from("ai_messages").insert({ conversation_id: conversationId, user_id: auth.userId, role: "user", content: parsed.data.message });
  try {
    const answer = await tutorQuestion({ apiKey: auth.apiKey, question: question.question_text, correctAnswer: question.correct_answer ?? "", solution: question.solution_text ?? "", originalAnswer: question.original_answer ?? "", errorNote: question.error_note ?? "", mode: parsed.data.mode, userMessage: parsed.data.message, model: auth.model });
    await auth.supabase.from("ai_messages").insert({ conversation_id: conversationId, user_id: auth.userId, role: "assistant", content: answer });
    return NextResponse.json({ answer, conversationId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: friendlyGeminiError(error) }, { status: 502 });
  }
}
