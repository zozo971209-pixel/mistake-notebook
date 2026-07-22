"use client";

import { useState } from "react";
import { Bot, Loader2, Send, UserRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Message = { role: "user" | "assistant"; content: string };

export function AiTutor({ questionId }: { questionId: string }) {
  const [mode, setMode] = useState("hint");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const prompt = text.trim();
    if (!prompt) return;
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setText("");
    const key = sessionStorage.getItem("mistake_notebook_gemini_key");
    const response = await fetch("/api/ai/tutor", { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "x-gemini-api-key": key } : {}) }, body: JSON.stringify({ questionId, conversationId, mode, message: prompt }) });
    const result = await response.json() as { answer?: string; conversationId?: string; error?: string };
    setBusy(false);
    if (!response.ok || !result.answer) return setError(result.error ?? "AI 回覆失敗");
    setConversationId(result.conversationId ?? conversationId);
    setMessages((current) => [...current, { role: "assistant", content: result.answer! }]);
  }

  return (
    <Card>
      <CardHeader><CardTitle>AI 教師</CardTitle><CardDescription>預設先提示，不急著公布答案。AI 內容可能有誤，重要答案請和課本或教師版本核對。</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <Select value={mode} onValueChange={setMode}><SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hint">分層提示</SelectItem><SelectItem value="socratic">蘇格拉底引導</SelectItem><SelectItem value="diagnose">錯因診斷</SelectItem><SelectItem value="explain">完整講解</SelectItem><SelectItem value="similar">產生相似題</SelectItem></SelectContent></Select>
        <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-xl border bg-background/40 p-4">
          {!messages.length && <p className="py-10 text-center text-sm text-muted-foreground">可以問：「不要直接給答案，先告訴我第一步該觀察什麼？」</p>}
          {messages.map((message, index) => <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>{message.role === "assistant" && <Bot className="mt-1 size-5 shrink-0 text-primary" />}<div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-7 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{message.content}</div>{message.role === "user" && <UserRound className="mt-1 size-5 shrink-0" />}</div>)}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />AI 正在整理思路…</div>}
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex gap-2"><Textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder="輸入追問…" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void send(); }} /><Button size="icon" className="h-auto w-12" onClick={send} disabled={busy || !text.trim()}><Send /></Button></div>
        <p className="text-xs text-muted-foreground">Ctrl / ⌘ + Enter 送出。若未設定自己的 Key，會嘗試使用網站公共額度。</p>
      </CardContent>
    </Card>
  );
}
