"use client";

import { useMemo, useState } from "react";
import { Bot, Check, Loader2, Sparkles, WandSparkles, X } from "lucide-react";
import { useLocalData } from "@/lib/local-data/provider";
import type { LocalQuestion, LocalSubject } from "@/lib/local-data/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { classifyQuestions, friendlyGeminiError, readGeminiCredentials } from "@/lib/ai/gemini";

export function QuestionBankAI({ questions, subjects }: { questions: LocalQuestion[]; subjects: LocalSubject[] }) {
  const { assignQuestions } = useLocalData();
  const candidates = useMemo(() => questions.filter((q) => !q.subject_id || !q.chapter?.trim()), [questions]);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<Array<{ id: string; subject: string; chapter: string; confidence: number; reason: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const subjectMap = new Map(subjects.map((s) => [s.name, s.id]));

  async function classify() {
    if (!selected.length) return setMessage("請先勾選要整理的題目。");
    setBusy(true); setMessage("");
    try {
      const { apiKey, model } = readGeminiCredentials();
      if (!apiKey) throw new Error("請先到設定頁加入自己的 API Key。");
      const assignments = await classifyQuestions({
        apiKey,
        model: model || undefined,
        subjects: subjects.map((subject) => subject.name),
        questions: candidates.filter((question) => selected.includes(question.id)).map((question) => ({ id: question.id, title: question.title ?? "", questionText: question.question_text })),
      });
      setPreview(assignments);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 歸類失敗";
      setMessage(message.startsWith("請先") ? message : friendlyGeminiError(error));
    }
    finally { setBusy(false); }
  }

  async function apply() {
    const assignments = preview.map((item) => ({ id: item.id, subjectId: subjectMap.get(item.subject) ?? "", chapter: item.chapter })).filter((item) => item.subjectId && item.chapter);
    if (!assignments.length) return setMessage("沒有可套用的有效歸類，請先確認科目名稱。");
    setBusy(true); setMessage("");
    try {
      await assignQuestions(assignments);
      setPreview([]);
      setSelected([]);
      setMessage("已套用 AI 建議，你仍可在題目編輯頁調整。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法套用歸類。");
    } finally { setBusy(false); }
  }

  if (!candidates.length) return <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground"><Sparkles className="mr-2 inline size-4 text-primary" />目前沒有缺少科目或節點的題目。</div>;
  return <section className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold"><Bot className="size-4 text-primary" />AI 歸類到學習地圖</div><p className="mt-1 text-sm text-muted-foreground">只整理尚未有完整「科目＋節點」的題目；AI 先提出建議，你確認後才會寫入。</p></div><Button size="sm" onClick={() => void classify()} disabled={busy || !selected.length}>{busy ? <Loader2 className="animate-spin" /> : <WandSparkles />}產生建議</Button></div><div className="mt-4 grid gap-2">{candidates.slice(0, 20).map((q) => <label key={q.id} className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background/70 p-3 text-sm hover:border-primary/40"><input type="checkbox" className="mt-1 size-4 accent-[hsl(var(--primary))]" checked={selected.includes(q.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, q.id] : current.filter((id) => id !== q.id))} /><span className="line-clamp-2">{q.title || q.question_text}</span><Badge variant="outline" className="ml-auto shrink-0">{q.chapter || "未分節"}</Badge></label>)}</div>{preview.length > 0 && <div className="mt-4 rounded-xl border bg-background p-3"><div className="mb-2 flex items-center justify-between"><p className="font-medium">確認 AI 建議</p><Button variant="ghost" size="icon" onClick={() => setPreview([])}><X /></Button></div><div className="space-y-2">{preview.map((item) => <div key={item.id} className="rounded-lg bg-muted/40 p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge>{item.subject}</Badge><span>→</span><strong>{item.chapter}</strong><span className="text-xs text-muted-foreground">信心 {Math.round(item.confidence * 100)}%</span></div><p className="mt-1 text-xs text-muted-foreground">{item.reason}</p></div>)}</div><Button className="mt-3 w-full" onClick={() => void apply()} disabled={busy}><Check />套用至節點</Button></div>}{message && <p className="mt-3 text-sm text-destructive">{message}</p>}</section>;
}
