"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, Send, UserRound } from "lucide-react";
import { AI_AGE_CONFIRMATION_KEY, AI_AGE_ERROR, AI_AGE_HEADER } from "@/lib/ai/age";
import type { LocalQuestion } from "@/lib/local-data/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Message = { role: "user" | "assistant"; content: string };

export function AiTutor({ question }: { question: LocalQuestion }) {
  const [mode, setMode] = useState("hint");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAgeConfirmed(
        window.localStorage.getItem(AI_AGE_CONFIRMATION_KEY) === "1",
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function send() {
    const prompt = text.trim();
    if (!prompt) return;
    if (!ageConfirmed) return setError(AI_AGE_ERROR);
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setText("");
    const key = sessionStorage.getItem("mistake_notebook_gemini_key");
    const model = localStorage.getItem("mistake_notebook_gemini_model") ?? "";
    const response = await fetch("/api/ai/tutor", { method: "POST", headers: { "Content-Type": "application/json", [AI_AGE_HEADER]: "1", ...(key ? { "x-gemini-api-key": key } : {}), ...(model ? { "x-gemini-model": model } : {}) }, body: JSON.stringify({ mode, message: prompt, question: { questionText: question.question_text, correctAnswer: question.correct_answer ?? "", solution: question.solution_text ?? "", originalAnswer: question.original_answer ?? "", errorNote: question.error_note ?? "" } }) });
    const result = await response.json() as { answer?: string; error?: string };
    setBusy(false);
    if (!response.ok || !result.answer) return setError(result.error ?? "AI 回覆失敗");
    setMessages((current) => [...current, { role: "assistant", content: result.answer! }]);
  }

  return (
    <Card>
        <CardHeader><CardTitle>解題助手</CardTitle><CardDescription>先從提示開始；重要答案仍請和課本或教師版本核對。</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-secondary/70 p-3">
          <Checkbox id="tutor-age" checked={ageConfirmed} onCheckedChange={(value) => { const confirmed = Boolean(value); setAgeConfirmed(confirmed); if (confirmed) localStorage.setItem(AI_AGE_CONFIRMATION_KEY, "1"); else localStorage.removeItem(AI_AGE_CONFIRMATION_KEY); }} />
          <Label htmlFor="tutor-age" className="text-xs leading-5">我確認已年滿 18 歲。未滿 18 歲仍可使用題庫與重作功能，但不能啟用 Gemini 解題。</Label>
        </div>
        <Select value={mode} onValueChange={setMode}><SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hint">分層提示</SelectItem><SelectItem value="socratic">蘇格拉底引導</SelectItem><SelectItem value="diagnose">錯因診斷</SelectItem><SelectItem value="explain">完整講解</SelectItem><SelectItem value="similar">產生相似題</SelectItem></SelectContent></Select>
        <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-xl border bg-background/40 p-4">
          {!messages.length && <p className="py-10 text-center text-sm text-muted-foreground">可以問：「不要直接給答案，先告訴我第一步該觀察什麼？」</p>}
          {messages.map((message, index) => <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>{message.role === "assistant" && <Bot className="mt-1 size-5 shrink-0 text-primary" />}<div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-7 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{message.content}</div>{message.role === "user" && <UserRound className="mt-1 size-5 shrink-0" />}</div>)}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />正在整理…</div>}
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex gap-2"><Textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder={ageConfirmed ? "輸入追問…" : "確認年滿 18 歲後才能使用 AI"} disabled={!ageConfirmed} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void send(); }} /><Button size="icon" className="h-auto w-12" onClick={send} disabled={busy || !text.trim() || !ageConfirmed}><Send /></Button></div>
        <p className="text-xs text-muted-foreground">Ctrl / ⌘ + Enter 送出。只有送出問題時才會使用一次服務。</p>
      </CardContent>
    </Card>
  );
}
