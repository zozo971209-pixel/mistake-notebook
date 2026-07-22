import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/gemini";

export async function prepareAiRequest(request: Request, action: "extract_question" | "tutor" | "similar") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) return { error: "請先登入", status: 401 as const };

  const byok = request.headers.get("x-gemini-api-key")?.trim();
  const apiKey = byok || process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "網站公共 AI 尚未設定。請到「AI 與設定」加入自己的 Gemini API Key。", status: 503 as const };

  let model = DEFAULT_GEMINI_MODEL;

  if (byok) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("preferred_model")
      .eq("user_id", userId)
      .maybeSingle();
    if (settings?.preferred_model?.startsWith("gemini-")) model = settings.preferred_model;
  }

  if (!byok) {
    const { data: allowed, error } = await supabase.rpc("consume_ai_quota", { action_name: action, selected_model: model });
    if (error) return { error: "無法檢查公共 AI 額度。", status: 500 as const };
    if (!allowed) return { error: "今天的網站公共 AI 額度已用完。請加入自己的 Gemini API Key，或繼續手動使用題庫。", status: 429 as const };
  }

  return { supabase, userId, apiKey, model, byok: Boolean(byok) };
}
