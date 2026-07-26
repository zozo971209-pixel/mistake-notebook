"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, ExternalLink, KeyRound, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { AI_AGE_CONFIRMATION_KEY, AI_AGE_ERROR, AI_AGE_HEADER } from "@/lib/ai/age";
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
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const local = localStorage.getItem(LOCAL_KEY);
      const session = sessionStorage.getItem(SESSION_KEY);
      const saved = local || session || "";
      setAgeConfirmed(localStorage.getItem(AI_AGE_CONFIRMATION_KEY) === "1");
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
    if (!ageConfirmed) {
      setSuccess(false);
      setMessage(AI_AGE_ERROR);
      return;
    }
    setBusy(true);
    setMessage("");
    setSuccess(false);
    const response = await fetch("/api/ai/test-key", { method: "POST", headers: { "x-gemini-api-key": key.trim(), [AI_AGE_HEADER]: "1" } });
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
    if (!ageConfirmed) {
      setSuccess(false);
      setMessage(AI_AGE_ERROR);
      return;
    }
    setSyncBusy(true);
    setMessage("");
    setSuccess(false);
    const response = await fetch("/api/ai/credentials", { method: "POST", headers: { "Content-Type": "application/json", [AI_AGE_HEADER]: "1" }, body: JSON.stringify({ apiKey: key.trim() }) });
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
        <CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><KeyRound /></span><div><CardTitle>自己的 Gemini API Key</CardTitle><CardDescription>此功能依 Google 規定僅供年滿 18 歲者使用。</CardDescription></div></div></CardHeader>
        <CardContent className="space-y-4">
          <Alert><ShieldAlert /><AlertDescription>未滿 18 歲請不要申請、貼入或使用 Gemini API Key。你仍可完整使用手動新增、題庫、重作、複習與統計。</AlertDescription></Alert>
          <div className="flex items-start gap-3 rounded-xl bg-secondary/70 p-3"><Checkbox id="api-age" checked={ageConfirmed} onCheckedChange={(value) => { const confirmed = Boolean(value); setAgeConfirmed(confirmed); if (confirmed) localStorage.setItem(AI_AGE_CONFIRMATION_KEY, "1"); else localStorage.removeItem(AI_AGE_CONFIRMATION_KEY); }} /><div><Label htmlFor="api-age">我確認已年滿 18 歲</Label><p className="mt-1 text-xs leading-5 text-muted-foreground">本站不會要求或保存生日；此確認只用來控制 AI 功能。</p></div></div>
          <div className="space-y-2"><Label htmlFor="gemini-key">API Key</Label><Input id="gemini-key" type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder="貼上 AI Studio 建立的 Auth Key" disabled={!ageConfirmed} /></div>
          <div className="flex items-start gap-3"><Checkbox id="remember-key" checked={remember} onCheckedChange={(value) => setRemember(Boolean(value))} /><div><Label htmlFor="remember-key">記住於這個裝置</Label><p className="mt-1 text-xs text-muted-foreground">勾選後存於瀏覽器 localStorage；共用電腦請勿勾選。未勾選時關閉分頁即清除。</p></div></div>
          <div className="flex flex-wrap gap-3"><Button onClick={testAndSave} disabled={busy || !key.trim() || !ageConfirmed}>{busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}測試並套用到本機</Button><Button variant="outline" onClick={remove}><Trash2 />刪除本機 Key</Button></div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">跨裝置加密同步</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Key 由伺服器以 AES-256-GCM 加密後綁定你的帳號；手機不會看到完整 Key，但 AI 請求可直接使用。</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${synced ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{synced ? "已同步" : "尚未同步"}</span></div>
            <div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="secondary" onClick={() => void syncAcrossDevices()} disabled={syncBusy || !key.trim() || !ageConfirmed}>{syncBusy ? <Loader2 className="animate-spin" /> : <ShieldAlert />}{synced ? "更新同步 Key" : "加密並同步到手機"}</Button>{synced && <Button type="button" variant="ghost" onClick={() => void removeSynced()} disabled={syncBusy}><Trash2 />刪除同步 Key</Button>}</div>
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
      <CardHeader><CardTitle>如何申請可用的 Gemini API Key</CardTitle><CardDescription>以下依 2026 年 7 月 Google 官方規定與介面整理。</CardDescription></CardHeader>
      <CardContent className="space-y-6 text-sm leading-7">
        <Alert variant="destructive"><ShieldAlert /><AlertDescription><strong>申請與使用者必須年滿 18 歲。</strong>Google 目前也禁止將 Gemini API 提供給未滿 18 歲者。未滿 18 歲請使用本站的手動新增與複習功能，不要請他人代辦 Key。</AlertDescription></Alert>
        <ol className="space-y-5">
          <GuideStep n="1" title="先確認年齡與地區資格"><p>必須年滿 18 歲，並位於 Google 支援的地區。若不符合資格，停止申請並改用手動題庫。</p><Button asChild variant="ghost" size="sm" className="mt-2"><a href="https://ai.google.dev/gemini-api/docs/available-regions" target="_blank" rel="noreferrer">查看官方資格說明<ExternalLink /></a></Button></GuideStep>
          <GuideStep n="2" title="開啟 Google AI Studio"><p>以自己的 Google 帳號登入 API Keys 頁面。新使用者通常會看到預設專案，也能建立專門供本網站使用的專案。</p><Button asChild variant="outline" size="sm" className="mt-2"><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">前往 AI Studio<ExternalLink /></a></Button></GuideStep>
          <GuideStep n="3" title="建立新的 Auth Key"><p>按「Create API key」。新的 Key 預設為 Auth Key；不要使用未限制的舊式 Standard Key。</p></GuideStep>
          <GuideStep n="4" title="使用專用專案與最小權限"><p>不要和重要公司服務或高額付費專案共用。Key 只供 Gemini API 使用；發現外洩時立即撤銷並重新建立。</p></GuideStep>
          <GuideStep n="5" title="確認免費層與模型"><p>在 AI Studio 查看 Billing Tier 與 Rate Limits。免費額度依專案、地區與模型而異，不保證固定次數。</p></GuideStep>
          <GuideStep n="6" title="回到網站測試"><p>勾選年滿 18 歲後貼入 Key，先執行測試。成功後才能用於掃描與解題；出現 429 代表額度或速率已達上限。</p></GuideStep>
        </ol>
        <div className="flex flex-wrap gap-3 border-t pt-5"><Button asChild variant="ghost" size="sm"><a href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank" rel="noreferrer">官方 Key 安全說明<ExternalLink /></a></Button><Button asChild variant="ghost" size="sm"><a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer">官方價格與免費層<ExternalLink /></a></Button><Button asChild variant="ghost" size="sm"><a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noreferrer">查看 Rate Limits 說明<ExternalLink /></a></Button></div>
      </CardContent>
    </Card>
  );
}

function GuideStep({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return <li className="grid grid-cols-[32px_1fr] gap-3"><span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span><div><h3 className="font-semibold">{title}</h3><div className="mt-1 text-muted-foreground">{children}</div></div></li>;
}
