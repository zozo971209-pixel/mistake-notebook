import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { friendlyGeminiError, testGeminiKey } from "@/lib/ai/gemini";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
