import "server-only";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/gemini";
import { AI_AGE_ERROR, AI_AGE_HEADER } from "@/lib/ai/age";

export async function prepareAiRequest(request: Request, action: "extract_question" | "tutor" | "similar" | "classify_questions") {
  void action;
  if (request.headers.get(AI_AGE_HEADER) !== "1") return { error: AI_AGE_ERROR, status: 403 as const };
  const apiKey = request.headers.get("x-gemini-api-key")?.trim();
  if (!apiKey) return { error: "請先到設定頁加入自己的 Gemini API Key。本站不提供共用額度。", status: 401 as const };
  const requestedModel = request.headers.get("x-gemini-model")?.trim();
  const model = requestedModel?.startsWith("gemini-") && requestedModel.length <= 100 ? requestedModel : DEFAULT_GEMINI_MODEL;
  return { apiKey, model, byok: true as const };
}
