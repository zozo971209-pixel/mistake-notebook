import { NextResponse } from "next/server";
import { extractQuestion, friendlyGeminiError } from "@/lib/ai/gemini";
import { prepareAiRequest } from "@/lib/ai/request";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: Request) {
  const auth = await prepareAiRequest(request, "extract_question");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const form = await request.formData();
    const image = form.get("image");
    const subjectInput = JSON.parse(String(form.get("subjects") ?? "[]")) as unknown;
    const subjects = Array.isArray(subjectInput)
      ? subjectInput.filter((item): item is string => typeof item === "string").slice(0, 30)
      : [];
    if (!(image instanceof File)) return NextResponse.json({ error: "沒有收到圖片。" }, { status: 400 });
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) return NextResponse.json({ error: "只接受 JPG、PNG 或 WebP。" }, { status: 415 });
    if (image.size > 5 * 1024 * 1024) return NextResponse.json({ error: "壓縮後圖片仍超過 5 MB。" }, { status: 413 });

    const bytes = Buffer.from(await image.arrayBuffer());
    const data = await extractQuestion({ apiKey: auth.apiKey, imageBase64: bytes.toString("base64"), mimeType: image.type, subjects, model: auth.model });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: friendlyGeminiError(error) }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
