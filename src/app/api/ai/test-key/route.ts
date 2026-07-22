import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_GEMINI_MODEL, friendlyGeminiError } from "@/lib/ai/gemini";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const key = request.headers.get("x-gemini-api-key")?.trim();
  if (!key) return NextResponse.json({ error: "請輸入 API Key" }, { status: 400 });
  try {
    const response = await new GoogleGenAI({ apiKey: key }).models.generateContent({ model: DEFAULT_GEMINI_MODEL, contents: "Reply with exactly: OK", config: { maxOutputTokens: 10 } });
    return NextResponse.json({ ok: Boolean(response.text), model: DEFAULT_GEMINI_MODEL }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: friendlyGeminiError(error) }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
