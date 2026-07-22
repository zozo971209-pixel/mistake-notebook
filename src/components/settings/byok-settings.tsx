"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, ExternalLink, KeyRound, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SESSION_KEY = "mistake_notebook_gemini_key";
const LOCAL_KEY = "mistake_notebook_gemini_key_remembered";

export function ByokSettings() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const local = localStorage.getItem(LOCAL_KEY);
      const session = sessionStorage.getItem(SESSION_KEY);
      const saved = local || session || "";
      setKey(saved);
      setRemember(Boolean(local));
      if (saved) sessionStorage.setItem(SESSION_KEY, saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function testAndSave() {
    setBusy(true);
    setMessage("");
    setSuccess(false);
    const response = await fetch("/api/ai/test-key", { method: "POST", headers: { "x-gemini-api-key": key.trim() } });
    const result = await response.json() as { ok?: boolean; model?: string; error?: string };
    setBusy(false);
    if (!response.ok || !result.ok) return setMessage(result.error ?? "測試失敗");
    sessionStorage.setItem(SESSION_KEY, key.trim());
    if (remember) localStorage.setItem(LOCAL_KEY, key.trim()); else localStorage.removeItem(LOCAL_KEY);
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) await supabase.from("user_settings").update({ ai_key_mode: "browser_byok", preferred_model: result.model }).eq("user_id", data.claims.sub);
    setSuccess(true);
    setMessage(`連線成功，目前使用 ${result.model}。Key 僅保存在這個瀏覽器。`);
  }

  function remove() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCAL_KEY);
    setKey("");
    setRemember(false);
    setSuccess(false);
    setMessage("已從這個瀏覽器刪除 API Key。");
  }

  async function exportData() {
    const supabase = createClient();
    const [questions, subjects, reviews, conversations, messages, settings] = await Promise.all([
      supabase.from("questions").select("*"),
      supabase.from("subjects").select("*"),
      supabase.from("review_records").select("*"),
      supabase.from("ai_conversations").select("*"),
      supabase.from("ai_messages").select("*"),
      supabase.from("user_settings").select("*"),
    ]);
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), questions: questions.data, subjects: subjects.data, reviews: reviews.data, conversations: conversations.data, messages: messages.data, settings: settings.data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mistake-notebook-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setMessage(error.message);
      return;
    }
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCAL_KEY);
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><KeyRound /></span><div><CardTitle>自己的 Gemini API Key</CardTitle><CardDescription>公共額度不足時，可使用你自己的 Google 專案額度。</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label htmlFor="gemini-key">API Key</Label><Input id="gemini-key" type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder="貼上 AI Studio 建立的 Auth Key" /></div>
          <div className="flex items-start gap-3"><Checkbox id="remember-key" checked={remember} onCheckedChange={(value) => setRemember(Boolean(value))} /><div><Label htmlFor="remember-key">記住於這個裝置</Label><p className="mt-1 text-xs text-muted-foreground">勾選後存於瀏覽器 localStorage；共用電腦請勿勾選。未勾選時關閉分頁即清除。</p></div></div>
          <div className="flex flex-wrap gap-3"><Button onClick={testAndSave} disabled={busy || !key.trim()}>{busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}測試並套用</Button><Button variant="outline" onClick={remove}><Trash2 />刪除本機 Key</Button></div>
          {message && <Alert variant={success ? "default" : "destructive"}><AlertDescription>{message}</AlertDescription></Alert>}
          <Alert><ShieldAlert /><AlertTitle>安全界線</AlertTitle><AlertDescription>Key 會在你主動使用 AI 時送到本站伺服器代理，但不會寫入 Supabase、GitHub 或應用程式日誌。瀏覽器擴充功能仍可能讀取本機資料，因此建議使用專用且受限制的 Key。</AlertDescription></Alert>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>匯出個人資料</CardTitle><CardDescription>下載題目、作答紀錄、設定與 AI 對話的 JSON 備份；不包含照片，因為本站從未保存照片。</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={exportData}><Download />下載 JSON 備份</Button></CardContent></Card>
      <Card className="border-destructive/30"><CardHeader><CardTitle>刪除帳號</CardTitle><CardDescription>永久刪除登入帳號、題目、複習紀錄、設定與 AI 對話。建議先匯出備份。</CardDescription></CardHeader><CardContent><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive"><Trash2 />永久刪除帳號</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>這個動作無法復原</AlertDialogTitle><AlertDialogDescription>所有個人資料會立即從資料庫刪除。由於本站不保存圖片，因此沒有圖片檔案需要另外清除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={deleteAccount}>我了解，永久刪除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card>
    </div>
  );
}

export function GeminiGuide() {
  return (
    <Card>
      <CardHeader><CardTitle>如何申請可用的 Gemini API Key</CardTitle><CardDescription>Google 的介面與免費額度會變動；以下依 2026 年 7 月官方流程整理。</CardDescription></CardHeader>
      <CardContent className="space-y-6 text-sm leading-7">
        <ol className="space-y-5">
          <GuideStep n="1" title="開啟 Google AI Studio"><p>用自己的 Google 帳號登入，前往 API Keys 頁面。新使用者通常會得到預設專案，也可以建立專門供本網站使用的專案。</p><Button asChild variant="outline" size="sm" className="mt-2"><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">前往 AI Studio<ExternalLink /></a></Button></GuideStep>
          <GuideStep n="2" title="建立新的 Auth Key"><p>按「Create API key」。2026 年的新 Key 預設為綁定服務帳戶的 Auth Key；Google 預告 2026 年 9 月後將拒絕舊式 Standard Key，因此不要再建立未限制的舊 Key。</p></GuideStep>
          <GuideStep n="3" title="使用專用專案與最小權限"><p>不要和重要公司服務或高額付費專案共用。Key 應只用於 Gemini API；發現外洩時立即撤銷並重新建立。</p></GuideStep>
          <GuideStep n="4" title="確認免費層與模型"><p>在 AI Studio 查看 Billing Tier 與 Rate Limits。免費額度依專案、地區與模型而異，不保證固定次數。本站會讀取這把 Key 實際可用的模型，優先測試支援免費層且可處理圖片的穩定模型，不再寫死單一名稱。</p></GuideStep>
          <GuideStep n="5" title="貼入上方欄位並測試"><p>測試成功後即可掃描圖片與問 AI。若出現 429，代表速率或每日額度已達上限；若顯示需要 Billing，可更換有免費層的模型或依自己意願啟用付費。</p></GuideStep>
        </ol>
        <div className="flex flex-wrap gap-3 border-t pt-5"><Button asChild variant="ghost" size="sm"><a href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank" rel="noreferrer">官方 Key 安全說明<ExternalLink /></a></Button><Button asChild variant="ghost" size="sm"><a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer">官方價格與免費層<ExternalLink /></a></Button><Button asChild variant="ghost" size="sm"><a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noreferrer">查看 Rate Limits 說明<ExternalLink /></a></Button></div>
      </CardContent>
    </Card>
  );
}

function GuideStep({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return <li className="grid grid-cols-[32px_1fr] gap-3"><span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span><div><h3 className="font-semibold">{title}</h3><div className="mt-1 text-muted-foreground">{children}</div></div></li>;
}
