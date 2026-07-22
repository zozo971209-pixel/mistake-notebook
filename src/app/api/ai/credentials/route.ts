import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { encryptCredential } from "@/lib/ai/credential-crypto";
import { friendlyGeminiError, testGeminiKey } from "@/lib/ai/gemini";

const keySchema = z.object({ apiKey: z.string().trim().min(20).max(500) });

async function context() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, userId };
}

export async function GET() {
  const { supabase, userId } = await context();
  if (!userId) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const { data, error } = await supabase.from("user_ai_credentials").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) return NextResponse.json({ error: "無法讀取同步狀態" }, { status: 500 });
  return NextResponse.json({ exists: Boolean(data) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const { supabase, userId } = await context();
  if (!userId) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const parsed = keySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "API Key 格式不正確" }, { status: 400 });
  try {
    const model = await testGeminiKey(parsed.data.apiKey);
    const encrypted = encryptCredential(parsed.data.apiKey);
    const { error } = await supabase.from("user_ai_credentials").upsert({ user_id: userId, provider: "gemini", encrypted_key: encrypted.encryptedKey, iv: encrypted.iv, auth_tag: encrypted.authTag, updated_at: new Date().toISOString() });
    if (error) throw error;
    await supabase.from("user_settings").update({ ai_key_mode: "browser_byok", preferred_model: model }).eq("user_id", userId);
    return NextResponse.json({ ok: true, model }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: friendlyGeminiError(error) }, { status: 400 });
  }
}

export async function DELETE() {
  const { supabase, userId } = await context();
  if (!userId) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const { error } = await supabase.from("user_ai_credentials").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ error: "無法刪除同步 Key" }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
