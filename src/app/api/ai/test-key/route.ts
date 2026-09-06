import { NextResponse } from "next/server";
import { friendlyGeminiError, testGeminiKey } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const key = request.headers.get("x-gemini-api-key")?.trim();
  if (!key) return NextResponse.json({ error: "請輸入 API Key" }, { status: 400 });
  try { const model = await testGeminiKey(key); return NextResponse.json({ ok: true, model }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return NextResponse.json({ error: friendlyGeminiError(error) }, { status: 400, headers: { "Cache-Control": "private, no-store" } }); }
}
