"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { Camera, CheckCircle2, Loader2, ScanText, ShieldCheck, X } from "lucide-react";
import type { Tables } from "@/types/database";
import type { ExtractedQuestion, QuestionInput } from "@/lib/validations/question";
import { answerKindLabels, parseAnswerConfig, type AnswerConfig } from "@/lib/questions/answer-config";
import { createQuestionAction, updateQuestionAction } from "@/app/(app)/questions/actions";
import { AnswerConfigEditor } from "@/components/questions/answer-config-editor";
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
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [answerConfig, setAnswerConfig] = useState<AnswerConfig>(() => parseAnswerConfig(initial?.answer_config));
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function chooseFile(file?: File) {
    if (!file) return;
    setMessage("");
    setScanWarnings([]);
    if (!file.type.startsWith("image/")) {
      setMessageKind("error");
      setMessage("這個檔案不是圖片，請重新選擇。");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setMessageKind("error");
      setMessage("原始照片超過 20 MB，請降低相機解析度或先裁切後再試。");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setPreviewUrl("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function scan() {
    if (!selectedFile) {
      setMessageKind("error");
      setMessage("請先拍照或選擇一張題目圖片。");
      return;
    }
    setScanning(true);
    setMessage("");
    setScanWarnings([]);
    try {
      const compressed = await imageCompression(selectedFile, { maxSizeMB: 1.5, maxWidthOrHeight: 2200, useWebWorker: true, fileType: "image/webp" });
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
        questionType: data.questionType || answerKindLabels[data.answerConfig.kind],
        questionText: data.questionText,
        correctAnswer: data.detectedAnswer || current.correctAnswer,
        solutionText: data.solution || current.solutionText,
        keyConcepts: data.keyConcepts.join("、"),
        errorTypes: data.possibleErrorCauses,
        memoryTip: data.memoryTip,
      }));
      setAnswerConfig(data.answerConfig);
      setScanWarnings(data.warnings);
      setIsAiGenerated(true);
      setMessageKind("success");
      setMessage(`掃描完成（AI 信心 ${Math.round(data.confidence * 100)}%）。請逐欄確認後再儲存；原始照片已不再由本站持有。`);
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "掃描失敗，仍可手動輸入。");
    } finally {
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
      questionType: answerKindLabels[answerConfig.kind],
      answerConfig,
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
    <div className="space-y-6">
      {!initial && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><ScanText className="size-5" />AI 掃描題目</CardTitle>
              <Badge variant="secondary"><ShieldCheck />不保存照片</Badge>
            </div>
            <CardDescription>先拍照或選圖、確認預覽，再按下掃描。AI 會將辨識結果填入下方的一般新增表單。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input ref={fileRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => chooseFile(event.target.files?.[0])} />
            {previewUrl ? (
              <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
                  <Image src={previewUrl} alt="待掃描題目預覽" fill unoptimized className="object-contain" />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">照片已選擇，尚未送出</p>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{selectedFile?.name} · {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(1) : "0"} MB</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void scan()} disabled={scanning}>
                      {scanning ? <Loader2 className="animate-spin" /> : <ScanText />}
                      {scanning ? "正在壓縮與辨識…" : "開始 AI 掃描"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={scanning}><Camera />重新選擇</Button>
                    <Button type="button" variant="ghost" onClick={clearSelectedFile} disabled={scanning}><X />移除照片</Button>
                  </div>
                </div>
              </div>
            ) : (
              <button type="button" className="flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center transition-colors hover:bg-primary/10" onClick={() => fileRef.current?.click()}>
                <Camera className="size-8 text-primary" />
                <span className="font-medium">拍照或選擇題目圖片</span>
                <span className="text-sm text-muted-foreground">選擇後會先顯示預覽，不會立刻上傳</span>
              </button>
            )}
            <div className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">照片只會在你按下「開始 AI 掃描」後送往 AI 辨識；本站不會寫入磁碟、R2 或 Supabase Storage。掃描失敗時照片會留在畫面上，方便重試。</div>
            {message && (
              <Alert variant={messageKind === "error" ? "destructive" : "default"}>
                {messageKind === "success" ? <CheckCircle2 /> : <X />}
                <AlertTitle>{messageKind === "success" ? "掃描完成" : "掃描未完成"}</AlertTitle>
                <AlertDescription>{message}{scanWarnings.map((warning) => <span className="mt-1 block" key={warning}>• {warning}</span>)}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>一般新增</CardTitle><CardDescription>你可以手動填寫，也可以修改上方 AI 掃描後自動帶入的內容。</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="科目"><Select value={fields.subjectId} onValueChange={(value) => update("subjectId", value)}><SelectTrigger><SelectValue placeholder="選擇科目" /></SelectTrigger><SelectContent>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="章節"><Input value={fields.chapter} onChange={(e) => update("chapter", e.target.value)} placeholder="例如：二次函數" /></Field>
              <Field label="題目標題"><Input value={fields.title} onChange={(e) => update("title", e.target.value)} placeholder="方便搜尋的短標題" /></Field>
              <Field label="來源"><Input value={fields.source} onChange={(e) => update("source", e.target.value)} placeholder="講義、考卷或頁碼" /></Field>
              <Field label="難度"><Select value={fields.difficulty} onValueChange={(value) => update("difficulty", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n} / 5</SelectItem>)}</SelectContent></Select></Field>
            </div>
            <Field label="題目文字"><Textarea rows={8} required value={fields.questionText} onChange={(e) => update("questionText", e.target.value)} placeholder="請輸入或掃描題目…" /></Field>
            <AnswerConfigEditor value={answerConfig} onChange={setAnswerConfig} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>答案與錯因</CardTitle><CardDescription>真正重要的不是抄下答案，而是留下當時錯在哪裡。</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="我原本的答案"><Textarea rows={5} value={fields.originalAnswer} onChange={(e) => update("originalAnswer", e.target.value)} /></Field>
              <Field label={answerConfig.kind === "mixed" ? "文字補充的參考答案" : answerConfig.kind === "written" ? "正確答案" : "答案補充說明（選填）"}><Textarea rows={5} value={fields.correctAnswer} onChange={(e) => update("correctAnswer", e.target.value)} /></Field>
            </div>
            <Field label="完整解法"><Textarea rows={7} value={fields.solutionText} onChange={(e) => update("solutionText", e.target.value)} /></Field>
            <Field label={`錯誤原因（${selectedErrorLabel}）`}><div className="flex flex-wrap gap-2">{commonErrors.map((error) => { const active = fields.errorTypes.includes(error); return <Button key={error} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => update("errorTypes", active ? fields.errorTypes.filter((item) => item !== error) : [...fields.errorTypes, error])}>{error}</Button>; })}</div></Field>
            <Field label="錯誤反思"><Textarea rows={4} value={fields.errorNote} onChange={(e) => update("errorNote", e.target.value)} placeholder="我當時怎麼想？下次要注意什麼？" /></Field>
            <Field label="知識點（用頓號分隔）"><Input value={fields.keyConcepts} onChange={(e) => update("keyConcepts", e.target.value)} placeholder="配方法、判別式" /></Field>
            <Field label="一句話記憶提示"><Input value={fields.memoryTip} onChange={(e) => update("memoryTip", e.target.value)} /></Field>
          </CardContent>
        </Card>
        {initial && message && <Alert variant={messageKind === "error" ? "destructive" : "default"}><CheckCircle2 /><AlertTitle>處理結果</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
        <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => router.back()}>取消</Button><Button onClick={save} disabled={saving || !fields.questionText.trim()}>{saving && <Loader2 className="animate-spin" />}{initial ? "儲存修改" : "建立錯題"}</Button></div>
      </div>
      {isAiGenerated && <Button type="button" variant="ghost" size="sm" onClick={() => setIsAiGenerated(false)}><X />將這題標記為人工整理</Button>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
