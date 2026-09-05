import { NextResponse } from "next/server";
import { classifyQuestions, friendlyGeminiError } from "@/lib/ai/gemini";
import { prepareAiRequest } from "@/lib/ai/request";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: Request) {
  const auth = await prepareAiRequest(request, "classify_questions");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json() as { questions?: unknown; subjects?: unknown };
    const questions = Array.isArray(body.questions) ? body.questions.filter((q): q is { id: string; title?: string; questionText?: string } => Boolean(q && typeof q === "object" && typeof (q as { id?: unknown }).id === "string")).slice(0, 20) : [];
    const subjects = Array.isArray(body.subjects) ? body.subjects.filter((s): s is string => typeof s === "string").slice(0, 50) : [];
    if (!questions.length || !subjects.length) return NextResponse.json({ error: "請先選擇題目並建立科目。" }, { status: 400 });
    const assignments = await classifyQuestions({ apiKey: auth.apiKey, model: auth.model, subjects, questions: questions.map((q) => ({ id: q.id, title: q.title ?? "", questionText: q.questionText ?? "" })) });
    return NextResponse.json({ assignments }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: friendlyGeminiError(error) }, { status: 502 });
  }
}
