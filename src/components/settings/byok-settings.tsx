"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, ExternalLink, KeyRound, Loader2, ShieldAlert, Trash2, Upload } from "lucide-react";
import { AI_AGE_CONFIRMATION_KEY, AI_AGE_ERROR, AI_AGE_HEADER } from "@/lib/ai/age";
import { useLocalData } from "@/lib/local-data/provider";
import type { LearningMapBackup } from "@/lib/local-data/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SESSION_KEY = "mistake_notebook_gemini_key";
const LOCAL_KEY = "mistake_notebook_gemini_key_remembered";
const MODEL_KEY = "mistake_notebook_gemini_model";

export function ByokSettings({ section = "all" }: { section?: "all" | "key" | "data" }) {
  const data = useLocalData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<LearningMapBackup | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem(LOCAL_KEY) || sessionStorage.getItem(SESSION_KEY) || "";
      setAgeConfirmed(localStorage.getItem(AI_AGE_CONFIRMATION_KEY) === "1"); setKey(saved); setRemember(Boolean(localStorage.getItem(LOCAL_KEY)));
      if (saved) sessionStorage.setItem(SESSION_KEY, saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function testAndSave() {
    if (!ageConfirmed) return setMessage(AI_AGE_ERROR);
    setBusy(true); setMessage(""); setSuccess(false);
    try {
      const response = await fetch("/api/ai/test-key", { method: "POST", headers: { "x-gemini-api-key": key.trim(), [AI_AGE_HEADER]: "1" } });
      const result = await response.json() as { ok?: boolean; model?: string; error?: string };
      if (!response.ok || !result.ok || !result.model) throw new Error(result.error ?? "測試失敗");
      sessionStorage.setItem(SESSION_KEY, key.trim());
      if (remember) localStorage.setItem(LOCAL_KEY, key.trim()); else localStorage.removeItem(LOCAL_KEY);
      localStorage.setItem(MODEL_KEY, result.model); await data.updateSettings({ preferred_model: result.model });
      setSuccess(true); setMessage(`連線成功，目前使用 ${result.model}。Key 只保存在這個瀏覽器。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "測試失敗"); }
    finally { setBusy(false); }
  }
  function removeKey() { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(LOCAL_KEY); localStorage.removeItem(MODEL_KEY); setKey(""); setRemember(false); setSuccess(true); setMessage("已從這個瀏覽器刪除 API Key。"); }
  function downloadBackup(backup = data.exportBackup(), prefix = "learning-map") {
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  async function readBackup(file?: File) {
    if (!file) return;
    try { setPendingBackup(data.parseBackup(JSON.parse(await file.text()))); setSuccess(true); setMessage("備份檔檢查完成，請選擇合併或取代。"); }
    catch (error) { setSuccess(false); setMessage(error instanceof Error ? error.message : "無法讀取備份檔。"); }
    if (fileRef.current) fileRef.current.value = "";
  }
  async function applyImport(mode: "merge" | "replace") {
    if (!pendingBackup) return;
    if (mode === "replace") downloadBackup(data.exportBackup(), "before-replace");
    try { await data.importBackup(pendingBackup, mode); setPendingBackup(null); setSuccess(true); setMessage(mode === "merge" ? "備份已合併。" : "舊資料已先下載備份，並以匯入內容取代。"); }
    catch (error) { setSuccess(false); setMessage(error instanceof Error ? error.message : "匯入失敗，資料未完成更新。"); }
  }

  return <div className="space-y-6">
    {(section === "all" || section === "key") && <Card><CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><KeyRound /></span><div><CardTitle>自己的 Gemini API Key</CardTitle><CardDescription>選用功能；不用 AI 也能完整整理與複習錯題。</CardDescription></div></div></CardHeader><CardContent className="space-y-4"><Alert><ShieldAlert /><AlertDescription>依 Google 規定，未滿 18 歲請勿申請或使用 Gemini API；手動題庫與複習沒有年齡限制。</AlertDescription></Alert><div className="flex items-start gap-3 rounded-xl bg-secondary/70 p-3"><Checkbox id="api-age" checked={ageConfirmed} onCheckedChange={(value) => { const confirmed = Boolean(value); setAgeConfirmed(confirmed); if (confirmed) localStorage.setItem(AI_AGE_CONFIRMATION_KEY, "1"); else localStorage.removeItem(AI_AGE_CONFIRMATION_KEY); }} /><div><Label htmlFor="api-age">我確認已年滿 18 歲</Label><p className="mt-1 text-xs text-muted-foreground">只保存在目前瀏覽器，不會收集生日。</p></div></div><div className="space-y-2"><Label htmlFor="gemini-key">API Key</Label><Input id="gemini-key" type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder="貼上 Google AI Studio API Key" disabled={!ageConfirmed} /></div><div className="flex items-start gap-3"><Checkbox id="remember-key" checked={remember} onCheckedChange={(value) => setRemember(Boolean(value))} /><div><Label htmlFor="remember-key">記住於這個裝置</Label><p className="mt-1 text-xs text-muted-foreground">共用電腦請勿勾選；API Key 不會放入匯出檔。</p></div></div><div className="flex flex-wrap gap-3"><Button onClick={() => void testAndSave()} disabled={busy || !key.trim() || !ageConfirmed}>{busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}測試並套用</Button><Button variant="outline" onClick={removeKey}><Trash2 />刪除本機 Key</Button></div>{message && <Alert variant={success ? "default" : "destructive"}><AlertDescription>{message}</AlertDescription></Alert>}</CardContent></Card>}
    {(section === "all" || section === "data") && <><Alert><ShieldAlert /><AlertDescription>資料只保存在目前瀏覽器，不會自動同步到其他裝置；清除網站資料、使用無痕模式、移除瀏覽器資料或裝置空間不足時可能遺失，請定期匯出備份。照片只在掃描時處理且不保存，API Key 不會包含在備份中。</AlertDescription></Alert><Card><CardHeader><CardTitle>備份與搬移</CardTitle><CardDescription>JSON 備份包含科目、節點、錯題與複習紀錄，可帶到另一台裝置。</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => downloadBackup()}><Download />匯出備份</Button><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => void readBackup(event.target.files?.[0])} /><Button variant="outline" onClick={() => fileRef.current?.click()}><Upload />選擇備份檔</Button></div>{pendingBackup && <div className="rounded-xl border bg-muted/20 p-4"><p className="font-medium">待匯入：{pendingBackup.data.subjects.length} 科、{pendingBackup.data.nodes.length} 節點、{pendingBackup.data.questions.length} 題</p><p className="mt-1 text-xs text-muted-foreground">合併會保留現有資料；取代會先自動下載目前備份。</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void applyImport("merge")}>合併資料</Button><Button size="sm" variant="destructive" onClick={() => void applyImport("replace")}>取代全部</Button></div></div>}{message && <Alert variant={success ? "default" : "destructive"}><AlertDescription>{message}</AlertDescription></Alert>}</CardContent></Card><Card className="border-destructive/30"><CardHeader><CardTitle>清除此裝置資料</CardTitle><CardDescription>只影響目前瀏覽器，不會刪除任何遠端帳號。</CardDescription></CardHeader><CardContent><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive"><Trash2 />清除所有本機資料</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>確定清除本機題庫？</AlertDialogTitle><AlertDialogDescription>科目、節點、錯題與複習紀錄都會刪除。請先匯出備份。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => { downloadBackup(); void data.clearAll(); }}>先備份並清除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card></>}
  </div>;
}

export function GeminiGuide() { return <Card><CardHeader><CardTitle>取得 Gemini API Key</CardTitle><CardDescription>AI 是選用功能；實際免費額度以 Google AI Studio 顯示為準。</CardDescription></CardHeader><CardContent className="space-y-5 text-sm leading-7"><Alert variant="destructive"><ShieldAlert /><AlertDescription>必須年滿 18 歲才可申請與使用。未滿 18 歲請使用手動輸入、學習地圖與複習功能。</AlertDescription></Alert><ol className="space-y-4"><GuideStep n="1" title="開啟 Google AI Studio">使用自己的 Google 帳號開啟 API Keys 頁面。</GuideStep><GuideStep n="2" title="建立專用專案與 Key">按 Create API key，建議使用只供此網站使用的專案，不要共用重要或高額付費專案。</GuideStep><GuideStep n="3" title="確認模型與額度">查看 Billing Tier 與 Rate Limits；有些模型的免費額度可能為 0。</GuideStep><GuideStep n="4" title="回到本站測試">貼入 Key 並按「測試並套用」。Key 僅保存在你的瀏覽器。</GuideStep></ol><div className="flex flex-wrap gap-2 border-t pt-4"><Button asChild variant="outline"><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">前往 AI Studio<ExternalLink /></a></Button><Button asChild variant="ghost"><a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noreferrer">官方額度說明<ExternalLink /></a></Button></div></CardContent></Card>; }
function GuideStep({ n, title, children }: { n: string; title: string; children: React.ReactNode }) { return <li className="grid grid-cols-[32px_1fr] gap-3"><span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span><div><h3 className="font-semibold">{title}</h3><div className="mt-1 text-muted-foreground">{children}</div></div></li>; }
