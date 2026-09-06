import "server-only";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/gemini";

export async function prepareAiRequest(request: Request, action: "extract_question" | "tutor" | "similar" | "classify_questions") {
  void action;
  const apiKey = request.headers.get("x-gemini-api-key")?.trim();
  if (!apiKey) return { error: "請先到設定頁加入自己的 API Key。本站不提供共用額度。", status: 401 as const };
  const requestedModel = request.headers.get("x-gemini-model")?.trim();
  const model = requestedModel?.startsWith("gemini-") && requestedModel.length <= 100 ? requestedModel : DEFAULT_GEMINI_MODEL;
  return { apiKey, model, byok: true as const };
}
