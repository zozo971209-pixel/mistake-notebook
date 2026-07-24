"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, ExternalLink, KeyRound, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SESSION_KEY = "mistake_notebook_gemini_key";
const LOCAL_KEY = "mistake_notebook_gemini_key_remembered";

export function ByokSettings({ section = "all" }: { section?: "all" | "key" | "data" }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [synced, setSynced] = useState(false);
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

  useEffect(() => {
    void fetch("/api/ai/credentials", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result: { exists?: boolean } | null) => setSynced(Boolean(result?.exists)));
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

  async function syncAcrossDevices() {
    setSyncBusy(true);
    setMessage("");
    setSuccess(false);
    const response = await fetch("/api/ai/credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: key.trim() }) });
    const result = await response.json() as { ok?: boolean; model?: string; error?: string };
    setSyncBusy(false);
    if (!response.ok || !result.ok) return setMessage(result.error ?? "無法同步 API Key");
    sessionStorage.setItem(SESSION_KEY, key.trim());
    setSynced(true);
    setSuccess(true);
    setMessage(`已使用 AES-256 加密同步。手機以同一帳號登入後可直接使用 ${result.model}，不需重貼 Key。`);
  }

  async function removeSynced() {
    setSyncBusy(true);
    const response = await fetch("/api/ai/credentials", { method: "DELETE" });
    setSyncBusy(false);
    if (!response.ok) return setMessage("無法刪除同步 Key，請稍後再試。");
    setSynced(false);
    setSuccess(true);
    setMessage("已刪除帳號中的加密同步 Key；各裝置的本機 Key 不受影響。");
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
      {(section === "all" || section === "key") && <Card>
        <CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><KeyRound /></span><div><CardTitle>自己的 Gemini API Key</CardTitle><CardDescription>公共額度不足時，可使用你自己的 Google 專案額度。</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label htmlFor="gemini-key">API Key</Label><Input id="gemini-key" type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder="貼上 AI Studio 建立的 Auth Key" /></div>
          <div className="flex items-start gap-3"><Checkbox id="remember-key" checked={remember} onCheckedChange={(value) => setRemember(Boolean(value))} /><div><Label htmlFor="remember-key">記住於這個裝置</Label><p className="mt-1 text-xs text-muted-foreground">勾選後存於瀏覽器 localStorage；共用電腦請勿勾選。未勾選時關閉分頁即清除。</p></div></div>
          <div className="flex flex-wrap gap-3"><Button onClick={testAndSave} disabled={busy || !key.trim()}>{busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}測試並套用到本機</Button><Button variant="outline" onClick={remove}><Trash2 />刪除本機 Key</Button></div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">跨裝置加密同步</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Key 由伺服器以 AES-256-GCM 加密後綁定你的帳號；手機不會看到完整 Key，但 AI 請求可直接使用。</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${synced ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>{synced ? "已同步" : "尚未同步"}</span></div>
            <div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="secondary" onClick={() => void syncAcrossDevices()} disabled={syncBusy || !key.trim()}>{syncBusy ? <Loader2 className="animate-spin" /> : <ShieldAlert />}{synced ? "更新同步 Key" : "加密並同步到手機"}</Button>{synced && <Button type="button" variant="ghost" onClick={() => void removeSynced()} disabled={syncBusy}><Trash2 />刪除同步 Key</Button>}</div>
          </div>
          {message && <Alert variant={success ? "default" : "destructive"}><AlertDescription>{message}</AlertDescription></Alert>}
          <details className="rounded-xl border bg-muted/15"><summary className="cursor-pointer list-none p-4 text-sm font-medium">查看安全與技術說明</summary><div className="border-t p-4 text-sm leading-6 text-muted-foreground">本機模式只存在瀏覽器；同步後只保存加密內容，明文不會寫入 GitHub 或日誌。建議使用專用且受限制的 Key。</div></details>
        </CardContent>
      </Card>}
      {(section === "all" || section === "data") && <><Card><CardHeader><CardTitle>匯出個人資料</CardTitle><CardDescription>下載題目、作答紀錄與設定；照片從未保存，因此不包含照片。</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={exportData}><Download />下載 JSON 備份</Button></CardContent></Card><Card className="border-destructive/30"><CardHeader><CardTitle>刪除帳號</CardTitle><CardDescription>永久刪除帳號與所有題庫資料。建議先匯出備份。</CardDescription></CardHeader><CardContent><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive"><Trash2 />永久刪除帳號</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>這個動作無法復原</AlertDialogTitle><AlertDialogDescription>所有個人資料會立即從資料庫刪除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={deleteAccount}>我了解，永久刪除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card></>}
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
