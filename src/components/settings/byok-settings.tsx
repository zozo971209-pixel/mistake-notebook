"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, ExternalLink, HardDrive, KeyRound, Loader2, RotateCcw, ShieldAlert, Trash2, Upload } from "lucide-react";
import { InstallAppCard } from "@/components/settings/install-app-card";
import { friendlyGeminiError, testGeminiKey } from "@/lib/ai/gemini";
import { useLocalData } from "@/lib/local-data/provider";
import type { LearningMapBackup } from "@/lib/local-data/types";
import { downloadJson } from "@/lib/download-json";
import { openExternalUrl } from "@/lib/open-external-url";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const SESSION_KEY = "mistake_notebook_gemini_key";
const LOCAL_KEY = "mistake_notebook_gemini_key_remembered";
const MODEL_KEY = "mistake_notebook_gemini_model";

export function ByokSettings({ section = "all" }: { section?: "all" | "key" | "data" }) {
  const data = useLocalData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<LearningMapBackup | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number; appData: number }>({ usage: 0, quota: 0, appData: 0 });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem(LOCAL_KEY) || sessionStorage.getItem(SESSION_KEY) || "";
      setKey(saved);
      setRemember(Boolean(localStorage.getItem(LOCAL_KEY)));
      if (saved) sessionStorage.setItem(SESSION_KEY, saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const estimate = await navigator.storage?.estimate?.();
      const appData = new Blob([JSON.stringify({ subjects: data.subjects, diagrams: data.diagrams, knowledgeCards: data.knowledge_cards, nodes: data.nodes, questions: data.questions, reviews: data.reviews, trash: data.trash, settings: data.settings })]).size;
      if (!cancelled) setStorage({ usage: estimate?.usage ?? appData, quota: estimate?.quota ?? 0, appData });
    }, 150);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [data.subjects, data.diagrams, data.knowledge_cards, data.nodes, data.questions, data.reviews, data.settings, data.trash]);

  async function testAndSave() {
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      const model = await testGeminiKey(key.trim());
      sessionStorage.setItem(SESSION_KEY, key.trim());
      if (remember) localStorage.setItem(LOCAL_KEY, key.trim()); else localStorage.removeItem(LOCAL_KEY);
      localStorage.setItem(MODEL_KEY, model);
      await data.updateSettings({ preferred_model: model });
      setSuccess(true);
      setMessage(`連線成功，目前使用 ${model}。Key 只保存在這個裝置。`);
    } catch (error) {
      setMessage(friendlyGeminiError(error));
    } finally {
      setBusy(false);
    }
  }

  function removeKey() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCAL_KEY);
    localStorage.removeItem(MODEL_KEY);
    setKey("");
    setRemember(false);
    setSuccess(true);
    setMessage("已從這個裝置刪除 API Key。");
  }

  async function downloadBackup(backup = data.exportBackup(), prefix = "learning-map", announce = true) {
    setBackupBusy(true);
    try {
      const path = await downloadJson(backup, prefix);
      if (announce) {
        setSuccess(true);
        setMessage(`備份已儲存：${path}`);
      }
      return path;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`備份沒有寫入，資料未變更：${detail}`);
    } finally {
      setBackupBusy(false);
    }
  }

  async function readBackup(file?: File) {
    if (!file) return;
    try {
      setPendingBackup(data.parseBackup(JSON.parse(await file.text())));
      setSuccess(true);
      setMessage("備份檔檢查完成，請選擇合併或取代。");
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "無法讀取備份檔。");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function applyImport(mode: "merge" | "replace") {
    if (!pendingBackup) return;
    try {
      if (mode === "replace") await downloadBackup(data.exportBackup(), "before-replace", false);
      await data.importBackup(pendingBackup, mode);
      setPendingBackup(null);
      setSuccess(true);
      setMessage(mode === "merge" ? "備份已合併。" : "舊資料已先下載備份，並以匯入內容取代。");
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "匯入失敗，資料未完成更新。");
    }
  }

  async function backupAndClear() {
    try {
      const path = await downloadBackup(data.exportBackup(), "before-clear", false);
      await data.clearAll();
      setSuccess(true);
      setMessage(`本機資料已清除；清除前備份已儲存：${path}`);
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "備份失敗，因此沒有清除任何資料。");
    }
  }

  async function restoreTrash(id: string) {
    try {
      await data.restoreTrashItem(id);
      setSuccess(true);
      setMessage("項目已還原。");
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "無法還原項目。");
    }
  }

  return <div className="space-y-6">
    {(section === "all" || section === "key") && <Card><CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><KeyRound /></span><div><CardTitle>自己的 API Key</CardTitle><CardDescription>加入 API Key，才能使用掃描、歸類與解題功能。</CardDescription></div></div></CardHeader><CardContent className="space-y-4">
      <div className="space-y-2"><Label htmlFor="gemini-key">API Key</Label><Input id="gemini-key" type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} placeholder="貼上 Google AI Studio API Key" /></div>
      <div className="flex items-start gap-3"><Checkbox id="remember-key" checked={remember} onCheckedChange={(value) => setRemember(Boolean(value))} /><div><Label htmlFor="remember-key">記住於這個裝置</Label><p className="mt-1 text-xs text-muted-foreground">共用電腦請勿勾選；API Key 不會放入匯出檔。</p></div></div>
      <div className="flex flex-wrap gap-3"><Button onClick={() => void testAndSave()} disabled={busy || !key.trim()}>{busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}測試並套用</Button><Button variant="outline" onClick={removeKey}><Trash2 />刪除本機 Key</Button></div>
      {message && <Alert variant={success ? "default" : "destructive"}><AlertDescription>{message}</AlertDescription></Alert>}
    </CardContent></Card>}

    {(section === "all" || section === "data") && <>
      <Alert><ShieldAlert /><AlertDescription>資料只保存在目前瀏覽器，不會自動同步到其他裝置；清除網站資料、使用無痕模式、移除瀏覽器資料或裝置空間不足時可能遺失，請定期匯出備份。照片只在掃描時處理且不保存，API Key 不會包含在備份中。</AlertDescription></Alert>
      <InstallAppCard />
      <Card><CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><HardDrive /></span><div><CardTitle>本機容量</CardTitle><CardDescription>圖片會先壓縮再保存；容量由目前裝置與系統決定。</CardDescription></div></div></CardHeader><CardContent className="space-y-3"><Progress value={storage.quota ? Math.min(100, storage.usage / storage.quota * 100) : 0} /><div className="grid gap-2 text-sm sm:grid-cols-2"><p>本程式備份資料：約 <strong>{formatBytes(storage.appData)}</strong></p><p>目前儲存空間：<strong>{formatBytes(storage.usage)}</strong>{storage.quota ? `／${formatBytes(storage.quota)}` : "（系統未提供上限）"}</p></div><p className="text-xs leading-5 text-muted-foreground">此數值包含目前來源的網站／App 儲存空間；不同瀏覽器或 Windows WebView 的可用上限可能不同。</p></CardContent></Card>
      <Card><CardHeader><CardTitle>備份與搬移</CardTitle><CardDescription>JSON 備份包含目前所有網站內容，可帶到另一台裝置。</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={backupBusy} onClick={() => void downloadBackup().catch((error) => { setSuccess(false); setMessage(error instanceof Error ? error.message : "備份失敗。"); })}>{backupBusy ? <Loader2 className="animate-spin" /> : <Download />}匯出備份</Button><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => void readBackup(event.target.files?.[0])} /><Button variant="outline" disabled={backupBusy} onClick={() => fileRef.current?.click()}><Upload />匯入備份檔</Button></div>{pendingBackup && <div className="rounded-xl border bg-muted/20 p-4"><p className="font-medium">待匯入：{pendingBackup.data.subjects.length} 個主題、{pendingBackup.data.diagrams.length} 張架構圖、{pendingBackup.data.nodes.length} 個節點、{pendingBackup.data.questions.length} 題</p><p className="mt-1 text-xs text-muted-foreground">合併會保留現有資料；取代只會在目前資料先成功備份後執行。</p><div className="mt-3 flex gap-2"><Button size="sm" disabled={backupBusy} onClick={() => void applyImport("merge")}>合併資料</Button><Button size="sm" variant="destructive" disabled={backupBusy} onClick={() => void applyImport("replace")}>取代全部</Button></div></div>}{message && <Alert variant={success ? "default" : "destructive"}><AlertDescription>{message}</AlertDescription></Alert>}</CardContent></Card>
      <Card><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle>資源回收桶</CardTitle><CardDescription>刪除的主題、節點與錯題會保留在這裡，直到你永久刪除。</CardDescription></div>{data.trash.length > 0 && <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><Trash2 />清空</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>永久清空資源回收桶？</AlertDialogTitle><AlertDialogDescription>共 {data.trash.length} 個項目，清空後無法復原。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void data.emptyTrash()}>永久清空</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div></CardHeader><CardContent className="space-y-2">{data.trash.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border px-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{{ subject: "主題", node: "節點", question: "錯題" }[item.entity_type]} · {new Date(item.deleted_at).toLocaleString("zh-TW")}</p></div><Button type="button" variant="outline" size="sm" onClick={() => void restoreTrash(item.id)}><RotateCcw />還原</Button><Button type="button" variant="ghost" size="icon" className="text-destructive" title="永久刪除" onClick={() => { if (window.confirm("永久刪除這個項目？此操作無法復原。")) void data.permanentlyDeleteTrashItem(item.id); }}><Trash2 /></Button></div>)}{!data.trash.length && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">資源回收桶目前是空的。</p>}</CardContent></Card>
      <Card className="border-destructive/30"><CardHeader><CardTitle>清除此裝置資料</CardTitle><CardDescription>只影響目前瀏覽器，不會刪除任何遠端帳號。</CardDescription></CardHeader><CardContent><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive"><Trash2 />清除所有本機資料</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>確定清除本機題庫？</AlertDialogTitle><AlertDialogDescription>主題、架構圖、地圖內容、節點、錯題與複習紀錄都會刪除。只有在清除前備份成功後才會繼續。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction disabled={backupBusy} onClick={() => void backupAndClear()}>先備份並清除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card>
    </>}
  </div>;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index < 2 ? 0 : 1)} ${units[index]}`;
}

export function GeminiGuide() {
  const [linkError, setLinkError] = useState("");

  async function openOfficialPage(url: string) {
    setLinkError("");
    try {
      await openExternalUrl(url);
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : "無法開啟外部網頁。");
    }
  }

  return <div className="space-y-5">
    <Card><CardHeader><CardTitle>取得 Gemini API Key</CardTitle></CardHeader><CardContent className="space-y-5 text-sm leading-7">
      <Alert><ShieldAlert /><AlertDescription>帳戶需符合年滿 18 歲資格才可申請與使用 Gemini API Key；若帳戶資料有誤，請先至 Google 帳戶設定確認後再申請。</AlertDescription></Alert>
      <ol className="space-y-4"><GuideStep n="1" title="開啟 Google AI Studio">使用自己的 Google 帳號開啟 API Keys 頁面。</GuideStep><GuideStep n="2" title="建立專用專案與複製 Key">按 Create API key 並複製，建議使用只供此網站使用的專案，不要共用重要或高額付費專案。</GuideStep><GuideStep n="3" title="確認模型與額度">查看 Billing Tier 與 Rate Limits；模型、帳戶與地區的可用額度可能不同。</GuideStep><GuideStep n="4" title="回到本站測試">貼入 Key 並按「測試並套用」。Key 僅保存在你的瀏覽器。</GuideStep></ol>
      <div className="flex flex-wrap gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => void openOfficialPage("https://aistudio.google.com/api-keys")}><span>前往 AI Studio</span><ExternalLink /></Button><Button type="button" variant="ghost" onClick={() => void openOfficialPage("https://ai.google.dev/gemini-api/docs/rate-limits")}><span>官方額度說明</span><ExternalLink /></Button></div>
      {linkError && <Alert variant="destructive"><AlertDescription>{linkError}</AlertDescription></Alert>}
    </CardContent></Card>
  </div>;
}

function GuideStep({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return <li className="grid grid-cols-[32px_1fr] gap-3"><span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span><div><h3 className="font-semibold">{title}</h3><div className="mt-1 text-muted-foreground">{children}</div></div></li>;
}
