import { NextResponse } from "next/server";
import { z } from "zod";
import { friendlyGeminiError, tutorQuestion } from "@/lib/ai/gemini";
import { prepareAiRequest } from "@/lib/ai/request";

const inputSchema = z.object({
  mode: z.enum(["tutor", "hint", "socratic", "explain", "diagnose", "similar"]),
  message: z.string().trim().min(1).max(4000),
  question: z.object({ questionText: z.string().max(20000), correctAnswer: z.string().max(10000), solution: z.string().max(20000), originalAnswer: z.string().max(10000), errorNote: z.string().max(10000) }),
});
export const runtime = "nodejs";
export const maxDuration = 45;
export async function POST(request: Request) {
  const auth = await prepareAiRequest(request, "tutor");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "問題格式不正確。" }, { status: 400 });
  try {
    const answer = await tutorQuestion({ apiKey: auth.apiKey, question: parsed.data.question.questionText, correctAnswer: parsed.data.question.correctAnswer, solution: parsed.data.question.solution, originalAnswer: parsed.data.question.originalAnswer, errorNote: parsed.data.question.errorNote, mode: parsed.data.mode, userMessage: parsed.data.message, model: auth.model });
    return NextResponse.json({ answer }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: friendlyGeminiError(error) }, { status: 502 }); }
}
