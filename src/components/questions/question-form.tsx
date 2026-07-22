"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { Camera, CheckCircle2, Loader2, ScanText, ShieldCheck, X } from "lucide-react";
import type { Tables } from "@/types/database";
import type { ExtractedQuestion, QuestionInput } from "@/lib/validations/question";
import { createQuestionAction, updateQuestionAction } from "@/app/(app)/questions/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Question = Tables<"questions">;
type Subject = Tables<"subjects">;

const commonErrors = ["概念不懂", "公式記錯", "題意理解錯誤", "計算錯誤", "看錯數字", "遺漏條件", "粗心", "時間不足", "知識點混淆"];

export function QuestionForm({ subjects, initial }: { subjects: Subject[]; initial?: Question }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [isAiGenerated, setIsAiGenerated] = useState(initial?.is_ai_generated ?? false);
  const [fields, setFields] = useState({
    subjectId: initial?.subject_id ?? subjects[0]?.id ?? "",
    title: initial?.title ?? "",
    chapter: initial?.chapter ?? "",
    source: initial?.source ?? "",
    questionType: initial?.question_type ?? "",
    difficulty: initial?.difficulty?.toString() ?? "3",
    questionText: initial?.question_text ?? "",
    originalAnswer: initial?.original_answer ?? "",
    correctAnswer: initial?.correct_answer ?? "",
    solutionText: initial?.solution_text ?? "",
    keyConcepts: initial?.key_concepts.join("、") ?? "",
    errorTypes: initial?.error_types ?? [],
    errorNote: initial?.error_note ?? "",
    memoryTip: initial?.memory_tip ?? "",
  });

  const update = (name: keyof typeof fields, value: string | string[]) => setFields((current) => ({ ...current, [name]: value }));
  const selectedErrorLabel = useMemo(() => fields.errorTypes.length ? `已選 ${fields.errorTypes.length} 項` : "尚未選擇", [fields.errorTypes]);

  async function scan(file: File) {
    if (!file.type.startsWith("image/")) return setMessage("請選擇 JPG、PNG 或 WebP 圖片。");
    setScanning(true);
    setMessage("");
    setScanWarnings([]);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 2200, useWebWorker: true, fileType: "image/webp" });
      const body = new FormData();
      body.append("image", compressed, "scan.webp");
      body.append("subject", subjects.find((subject) => subject.id === fields.subjectId)?.name ?? "");
      const key = sessionStorage.getItem("mistake_notebook_gemini_key");
      const response = await fetch("/api/ai/extract-question", { method: "POST", body, headers: key ? { "x-gemini-api-key": key } : undefined });
      const payload = await response.json() as { data?: ExtractedQuestion; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "掃描失敗");
      const data = payload.data;
      setFields((current) => ({
        ...current,
        title: data.title || current.title,
        chapter: data.chapterSuggestion || current.chapter,
        questionType: data.questionType || current.questionType,
        questionText: data.questionText,
        correctAnswer: data.detectedAnswer || current.correctAnswer,
        solutionText: data.solution || current.solutionText,
        keyConcepts: data.keyConcepts.join("、"),
        errorTypes: data.possibleErrorCauses,
        memoryTip: data.memoryTip,
      }));
      setScanWarnings(data.warnings);
      setIsAiGenerated(true);
      setMessage(`掃描完成（AI 信心 ${Math.round(data.confidence * 100)}%）。請逐欄確認後再儲存；原始照片已不再由本站持有。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "掃描失敗，仍可手動輸入。");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      setScanning(false);
    }
  }

  function payload(): QuestionInput {
    const split = (value: string) => value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean);
    return {
      subjectId: fields.subjectId || null,
      title: fields.title || null,
      chapter: fields.chapter || null,
      source: fields.source || null,
      questionType: fields.questionType || null,
      difficulty: fields.difficulty ? Number(fields.difficulty) : null,
      questionText: fields.questionText,
      originalAnswer: fields.originalAnswer || null,
      correctAnswer: fields.correctAnswer || null,
      solutionText: fields.solutionText || null,
      keyConcepts: split(fields.keyConcepts),
      errorTypes: fields.errorTypes,
      errorNote: fields.errorNote || null,
      memoryTip: fields.memoryTip || null,
      isAiGenerated,
    };
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const result = initial ? await updateQuestionAction(initial.id, payload()) : await createQuestionAction(payload());
    setSaving(false);
    if (result.error) return setMessage(result.error);
    router.push(`/questions/${result.id}`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>題目內容</CardTitle><CardDescription>先選科目，再掃描或手動輸入。所有 AI 結果都可以修改。</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="科目"><Select value={fields.subjectId} onValueChange={(value) => update("subjectId", value)}><SelectTrigger><SelectValue placeholder="選擇科目" /></SelectTrigger><SelectContent>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="章節"><Input value={fields.chapter} onChange={(e) => update("chapter", e.target.value)} placeholder="例如：二次函數" /></Field>
              <Field label="題目標題"><Input value={fields.title} onChange={(e) => update("title", e.target.value)} placeholder="方便搜尋的短標題" /></Field>
              <Field label="來源"><Input value={fields.source} onChange={(e) => update("source", e.target.value)} placeholder="講義、考卷或頁碼" /></Field>
              <Field label="題型"><Input value={fields.questionType} onChange={(e) => update("questionType", e.target.value)} placeholder="選擇、計算、申論…" /></Field>
              <Field label="難度"><Select value={fields.difficulty} onValueChange={(value) => update("difficulty", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n} / 5</SelectItem>)}</SelectContent></Select></Field>
            </div>
            <Field label="題目文字"><Textarea rows={8} required value={fields.questionText} onChange={(e) => update("questionText", e.target.value)} placeholder="請輸入或掃描題目…" /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>答案與錯因</CardTitle><CardDescription>真正重要的不是抄下答案，而是留下當時錯在哪裡。</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="我原本的答案"><Textarea rows={5} value={fields.originalAnswer} onChange={(e) => update("originalAnswer", e.target.value)} /></Field>
              <Field label="正確答案"><Textarea rows={5} value={fields.correctAnswer} onChange={(e) => update("correctAnswer", e.target.value)} /></Field>
            </div>
            <Field label="完整解法"><Textarea rows={7} value={fields.solutionText} onChange={(e) => update("solutionText", e.target.value)} /></Field>
            <Field label={`錯誤原因（${selectedErrorLabel}）`}><div className="flex flex-wrap gap-2">{commonErrors.map((error) => { const active = fields.errorTypes.includes(error); return <Button key={error} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => update("errorTypes", active ? fields.errorTypes.filter((item) => item !== error) : [...fields.errorTypes, error])}>{error}</Button>; })}</div></Field>
            <Field label="錯誤反思"><Textarea rows={4} value={fields.errorNote} onChange={(e) => update("errorNote", e.target.value)} placeholder="我當時怎麼想？下次要注意什麼？" /></Field>
            <Field label="知識點（用頓號分隔）"><Input value={fields.keyConcepts} onChange={(e) => update("keyConcepts", e.target.value)} placeholder="配方法、判別式" /></Field>
            <Field label="一句話記憶提示"><Input value={fields.memoryTip} onChange={(e) => update("memoryTip", e.target.value)} /></Field>
          </CardContent>
        </Card>
        {message && <Alert><CheckCircle2 /><AlertTitle>處理結果</AlertTitle><AlertDescription>{message}{scanWarnings.map((warning) => <span className="mt-1 block" key={warning}>• {warning}</span>)}</AlertDescription></Alert>}
        <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => router.back()}>取消</Button><Button onClick={save} disabled={saving || !fields.questionText.trim()}>{saving && <Loader2 className="animate-spin" />}{initial ? "儲存修改" : "建立錯題"}</Button></div>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
        <Card className="border-primary/20">
          <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-lg">AI 僅掃描</CardTitle><Badge variant="secondary"><ShieldCheck />不保存照片</Badge></div><CardDescription>圖片壓縮後只送出一次辨識請求，本站不寫入磁碟、R2 或 Supabase Storage。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) void scan(file); }} />
            <Button className="w-full" variant="outline" onClick={() => fileRef.current?.click()} disabled={scanning}>{scanning ? <Loader2 className="animate-spin" /> : <Camera />}{scanning ? "正在辨識…" : "拍照或選擇圖片"}</Button>
            <div className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground"><ScanText className="mb-2 size-4" />掃描後務必核對公式、上下標、圖表與答案。關閉或重新選圖後，本站無法找回原圖。</div>
            {isAiGenerated && <Button type="button" variant="ghost" size="sm" onClick={() => setIsAiGenerated(false)}><X />標記為人工整理</Button>}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
