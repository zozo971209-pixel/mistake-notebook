"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Crop, Loader2, MapPin, PenLine, ScanText, ShieldCheck, X } from "lucide-react";
import type { Tables } from "@/types/database";
import type { ExtractedQuestion, QuestionInput } from "@/lib/validations/question";
import { answerKindLabels, parseAnswerConfig, type AnswerConfig } from "@/lib/questions/answer-config";
import { AI_AGE_CONFIRMATION_KEY, AI_AGE_ERROR, AI_AGE_HEADER } from "@/lib/ai/age";
import { createQuestionAction, updateQuestionAction } from "@/app/(app)/questions/actions";
import { AnswerConfigEditor } from "@/components/questions/answer-config-editor";
import { ImageCropDialog } from "@/components/questions/image-crop-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Question = Tables<"questions">;
type Subject = Tables<"subjects">;

const commonErrors = ["概念不懂", "公式記錯", "題意理解錯誤", "計算錯誤", "看錯數字", "遺漏條件", "粗心", "時間不足", "知識點混淆"];
const errorIcons: Record<string, string> = { "概念不懂": "🧠", "公式記錯": "📐", "題意理解錯誤": "📖", "計算錯誤": "🔢", "看錯數字": "👀", "遺漏條件": "🧩", "粗心": "⚠️", "時間不足": "⏱️", "知識點混淆": "🔀" };

export function QuestionForm({ subjects, initial, defaultSubjectId = "", defaultChapter = "" }: { subjects: Subject[]; initial?: Question; defaultSubjectId?: string; defaultChapter?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [aiAgeConfirmed, setAiAgeConfirmed] = useState(false);
  const [step, setStep] = useState(initial ? 2 : 1);
  const [answerConfig, setAnswerConfig] = useState<AnswerConfig>(() => parseAnswerConfig(initial?.answer_config));
  const [isAiGenerated, setIsAiGenerated] = useState(initial?.is_ai_generated ?? false);
  const [fields, setFields] = useState({
    subjectId: initial?.subject_id ?? defaultSubjectId,
    title: initial?.title ?? "",
    chapter: initial?.chapter ?? defaultChapter,
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
  const selectedSubjectName = subjects.find((subject) => subject.id === fields.subjectId)?.name;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAiAgeConfirmed(
        window.localStorage.getItem(AI_AGE_CONFIRMATION_KEY) === "1",
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

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
    setCropOpen(true);
  }

  function applyCrop(file: File) {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMessageKind("success");
    setMessage("照片已裁切，確認預覽後即可掃描轉文字。");
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setPreviewUrl("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function scan() {
    if (!aiAgeConfirmed) {
      setMessageKind("error");
      setMessage(AI_AGE_ERROR);
      return;
    }
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
      body.append("subjects", JSON.stringify(subjects.map((subject) => subject.name)));
      const key = sessionStorage.getItem("mistake_notebook_gemini_key");
      const response = await fetch("/api/ai/extract-question", {
        method: "POST",
        body,
        headers: {
          [AI_AGE_HEADER]: "1",
          ...(key ? { "x-gemini-api-key": key } : {}),
        },
      });
      const payload = await response.json() as { data?: ExtractedQuestion; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "掃描失敗");
      const data = payload.data;
      const suggestedSubjectId = findSubjectId(subjects, data.subjectSuggestion);
      setFields((current) => ({
        ...current,
        subjectId: suggestedSubjectId || current.subjectId,
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
      setMessage(`掃描完成（AI 信心 ${Math.round(data.confidence * 100)}%）${suggestedSubjectId ? `，已自動選擇「${data.subjectSuggestion}」` : ""}。請逐欄確認後再儲存；原始照片已不再由本站持有。`);
      setStep(2);
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
    if (result.error) {
      setMessageKind("error");
      return setMessage(result.error);
    }
    router.push(`/questions/${result.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {!initial && <div className="grid grid-cols-3 gap-2">{["輸入題目", "確認內容", "記錄錯因"].map((label, index) => <button type="button" key={label} onClick={() => index + 1 < step && setStep(index + 1)} className={`rounded-xl px-3 py-3 text-sm transition ${step === index + 1 ? "bg-primary text-primary-foreground" : step > index + 1 ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"}`}><span className="mr-2 font-mono">{index + 1}</span>{label}</button>)}</div>}

      {step === 1 && !initial && <Card className="border-primary/20"><CardHeader><CardTitle>加入一道錯題</CardTitle><CardDescription>選擇最快的輸入方式，之後都能修改。</CardDescription></CardHeader><CardContent className="space-y-5"><input ref={fileRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => chooseFile(event.target.files?.[0])} />{previewUrl ? <div className="grid gap-5 md:grid-cols-[240px_1fr] md:items-center"><div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"><Image src={previewUrl} alt="待掃描題目預覽" fill unoptimized className="object-contain" /></div><div><Badge variant="secondary"><ShieldCheck />照片不保存</Badge><p className="mt-3 font-medium">照片準備好了</p><p className="mt-1 text-sm text-muted-foreground">掃描後會自動帶入題目、選項與最可能的科目。</p><div className="mt-4 flex items-start gap-3 rounded-xl bg-secondary/70 p-3"><Checkbox id="scan-age" checked={aiAgeConfirmed} onCheckedChange={(value) => { const confirmed = Boolean(value); setAiAgeConfirmed(confirmed); if (confirmed) localStorage.setItem(AI_AGE_CONFIRMATION_KEY, "1"); else localStorage.removeItem(AI_AGE_CONFIRMATION_KEY); }} /><Label htmlFor="scan-age" className="text-xs leading-5">我確認已年滿 18 歲，並了解此勾選只用來開放 Gemini AI 功能。</Label></div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" onClick={() => void scan()} disabled={scanning || !aiAgeConfirmed}>{scanning ? <Loader2 className="animate-spin" /> : <ScanText />}{scanning ? "正在辨識…" : "掃描轉文字"}</Button><Button type="button" variant="outline" onClick={() => setCropOpen(true)}><Crop />裁切</Button><Button type="button" variant="ghost" onClick={clearSelectedFile}><X />移除</Button></div></div></div> : <div className="grid gap-4 sm:grid-cols-2"><button type="button" onClick={() => fileRef.current?.click()} className="group flex min-h-52 flex-col items-center justify-center rounded-2xl border border-primary/25 bg-primary/5 p-6 text-center transition hover:border-primary/50 hover:bg-primary/10"><span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Camera /></span><span className="mt-4 text-lg font-semibold">拍照掃描</span><span className="mt-2 text-sm text-muted-foreground">限年滿 18 歲使用 AI 辨識</span></button><button type="button" onClick={() => setStep(2)} className="group flex min-h-52 flex-col items-center justify-center rounded-2xl border p-6 text-center transition hover:border-primary/40 hover:bg-accent/40"><span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-foreground"><PenLine /></span><span className="mt-4 text-lg font-semibold">手動輸入</span><span className="mt-2 text-sm text-muted-foreground">不限年齡、不使用 AI</span></button></div>}{message && <Alert variant={messageKind === "error" ? "destructive" : "default"}><AlertDescription>{message}{scanWarnings.map((warning) => <span className="mt-1 block" key={warning}>• {warning}</span>)}</AlertDescription></Alert>}</CardContent></Card>}

      {step === 2 && <Card><CardHeader><CardTitle>{initial ? "編輯題目" : "確認題目"}</CardTitle><CardDescription>先確認最重要的題目與作答方式。</CardDescription></CardHeader><CardContent className="space-y-5"><div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4"><div className="flex items-center gap-2 font-medium"><MapPin className="size-4 text-primary" />題目歸屬</div><p className="mt-1 text-sm text-muted-foreground">手動模式可直接把題目放入學習地圖的節點；AI 掃描只會提供建議，仍由你確認。</p><div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><Badge variant={selectedSubjectName ? "default" : "outline"}>{selectedSubjectName || "尚未選科目"}</Badge><span className="text-muted-foreground">→</span><Badge variant={fields.chapter ? "secondary" : "outline"}>{fields.chapter || "尚未設定節點"}</Badge></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="科目（手動設定）"><Select value={fields.subjectId} onValueChange={(value) => update("subjectId", value)}><SelectTrigger><SelectValue placeholder="選擇科目" /></SelectTrigger><SelectContent>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select></Field><Field label="題目標題"><Input value={fields.title} onChange={(e) => update("title", e.target.value)} placeholder="例如：二次函數判別式" /></Field></div><Field label="題目文字"><Textarea rows={8} required value={fields.questionText} onChange={(e) => update("questionText", e.target.value)} placeholder="請輸入或掃描題目…" /></Field><AnswerConfigEditor value={answerConfig} onChange={setAnswerConfig} /><details className="group rounded-xl border bg-muted/10" open={!fields.chapter}><summary className="cursor-pointer list-none p-4 font-medium">節點與補充資料 <span className="ml-2 text-xs font-normal text-muted-foreground">手動輸入節點名稱，之後可在學習地圖展開</span></summary><div className="grid gap-4 border-t p-4 sm:grid-cols-3"><Field label="節點／章節"><Input value={fields.chapter} onChange={(e) => update("chapter", e.target.value)} placeholder="例如：一元二次方程式" /></Field><Field label="來源"><Input value={fields.source} onChange={(e) => update("source", e.target.value)} /></Field><Field label="難度"><Select value={fields.difficulty} onValueChange={(value) => update("difficulty", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n} / 5</SelectItem>)}</SelectContent></Select></Field></div></details></CardContent></Card>}

      {step === 3 && <Card><CardHeader><CardTitle>記錄為什麼會錯</CardTitle><CardDescription>保留真正有助於下次答對的線索。</CardDescription></CardHeader><CardContent className="space-y-6"><div className="grid gap-4 md:grid-cols-2"><Field label="我原本的答案"><Textarea rows={4} value={fields.originalAnswer} onChange={(e) => update("originalAnswer", e.target.value)} /></Field><Field label={answerConfig.kind === "mixed" ? "文字補充的參考答案" : "答案補充（選填）"}><Textarea rows={4} value={fields.correctAnswer} onChange={(e) => update("correctAnswer", e.target.value)} /></Field></div><Field label={`錯誤原因（${selectedErrorLabel}）`}><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{commonErrors.map((error) => { const active = fields.errorTypes.includes(error); return <button key={error} type="button" className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm transition ${active ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent/40"}`} onClick={() => update("errorTypes", active ? fields.errorTypes.filter((item) => item !== error) : [...fields.errorTypes, error])}><span>{errorIcons[error]}</span>{error}</button>; })}</div></Field><Field label="下次要記住什麼？"><Textarea rows={3} value={fields.errorNote} onChange={(e) => update("errorNote", e.target.value)} placeholder="用自己的話留下最重要的提醒…" /></Field><details className="rounded-xl border bg-muted/10"><summary className="cursor-pointer list-none p-4 font-medium">更多筆記 <span className="ml-2 text-xs font-normal text-muted-foreground">解法、知識點與一句話提示</span></summary><div className="space-y-4 border-t p-4"><Field label="完整解法"><Textarea rows={6} value={fields.solutionText} onChange={(e) => update("solutionText", e.target.value)} /></Field><Field label="知識點（用頓號分隔）"><Input value={fields.keyConcepts} onChange={(e) => update("keyConcepts", e.target.value)} /></Field><Field label="一句話提示"><Input value={fields.memoryTip} onChange={(e) => update("memoryTip", e.target.value)} /></Field></div></details></CardContent></Card>}

      {step > 1 && message && (messageKind === "error" || step === 2) && <Alert variant={messageKind === "error" ? "destructive" : "default"}><AlertDescription>{message}{scanWarnings.map((warning) => <span className="mt-1 block" key={warning}>• {warning}</span>)}</AlertDescription></Alert>}
      {(step > 1 || initial) && <div className="flex items-center justify-between gap-3"><Button variant="ghost" onClick={() => initial && step === 2 ? router.back() : setStep((current) => Math.max(initial ? 2 : 1, current - 1))}><ChevronLeft />{initial && step === 2 ? "取消" : "上一步"}</Button>{step < 3 ? <Button onClick={() => setStep(3)} disabled={!fields.questionText.trim()}>下一步<ChevronRight /></Button> : <Button onClick={save} disabled={saving || !fields.questionText.trim()}>{saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{initial ? "儲存修改" : "儲存到題庫"}</Button>}</div>}
      <ImageCropDialog open={cropOpen} imageUrl={previewUrl} filename={selectedFile?.name ?? "question.webp"} onOpenChange={setCropOpen} onComplete={applyCrop} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function findSubjectId(subjects: Subject[], suggestion: string) {
  const aliases: Record<string, string> = {
    地球科學: "地科",
    earthscience: "地科",
    chinese: "國文",
    english: "英文",
    math: "數學",
    mathematics: "數學",
    physics: "物理",
    chemistry: "化學",
    biology: "生物",
    history: "歷史",
    geography: "地理",
    civics: "公民",
  };
  const normalize = (value: string) => value.toLowerCase().replace(/[\s（）()·_-]/g, "");
  const normalizedSuggestion = normalize(suggestion);
  const target = aliases[normalizedSuggestion] ?? suggestion;
  return subjects.find((subject) => normalize(subject.name) === normalize(target))?.id ?? "";
}
