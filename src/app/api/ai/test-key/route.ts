import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { friendlyGeminiError, testGeminiKey } from "@/lib/ai/gemini";
import { AI_AGE_ERROR, AI_AGE_HEADER } from "@/lib/ai/age";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (request.headers.get(AI_AGE_HEADER) !== "1") {
    return NextResponse.json({ error: AI_AGE_ERROR }, { status: 403 });
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const key = request.headers.get("x-gemini-api-key")?.trim();
  if (!key) return NextResponse.json({ error: "請輸入 API Key" }, { status: 400 });
  try {
    const model = await testGeminiKey(key);
    return NextResponse.json({ ok: true, model }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: friendlyGeminiError(error) }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
