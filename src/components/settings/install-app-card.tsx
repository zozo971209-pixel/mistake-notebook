"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, MonitorDown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    learningMapInstallPrompt?: InstallPromptEvent;
  }
}

export function InstallPromptCapture() {
  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      window.learningMapInstallPrompt = event as InstallPromptEvent;
      window.dispatchEvent(new Event("learning-map-install-ready"));
    };
    const appInstalled = () => {
      window.learningMapInstallPrompt = undefined;
      window.dispatchEvent(new Event("learning-map-installed"));
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);
  return null;
}

export function InstallAppCard() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setInstalled(window.matchMedia("(display-mode: standalone)").matches);
      setIsNativeApp("__TAURI_INTERNALS__" in window);
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
      setPromptEvent(window.learningMapInstallPrompt ?? null);
    }, 0);
    const installReady = () => setPromptEvent(window.learningMapInstallPrompt ?? null);
    const appInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("learning-map-install-ready", installReady);
    window.addEventListener("learning-map-installed", appInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("learning-map-install-ready", installReady);
      window.removeEventListener("learning-map-installed", appInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) {
      setShowHelp(true);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    window.learningMapInstallPrompt = undefined;
    setPromptEvent(null);
  }

  if (isNativeApp) return <Card><CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 /></span><div><CardTitle>Android App</CardTitle><CardDescription>你目前使用的是已安裝版本，題庫保存在這台裝置。</CardDescription></div></div></CardHeader></Card>;

  return <Card><CardHeader><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><MonitorDown /></span><div><CardTitle>安裝到桌面</CardTitle><CardDescription>以獨立視窗開啟學習地圖，不需另外下載安裝檔。</CardDescription></div></div></CardHeader><CardContent className="space-y-4">
    <p className="text-sm leading-6 text-muted-foreground">從目前瀏覽器安裝後，桌面版會使用同一網站與同一份本機題庫。不同瀏覽器、瀏覽器設定檔或裝置不會自動同步，請使用備份匯出與匯入搬移資料。</p>
    <Button variant={installed ? "secondary" : "default"} onClick={() => void install()} disabled={installed}>{installed ? <CheckCircle2 /> : <Download />}{installed ? "已安裝在此裝置" : "安裝到桌面"}</Button>
    {showHelp && !installed && <div className="rounded-xl border bg-muted/25 p-4 text-sm leading-6"><div className="flex items-center gap-2 font-medium"><Share2 className="size-4" />手動加入方式</div><p className="mt-2 text-muted-foreground">{isIOS ? "在 Safari 點擊分享按鈕，再選擇「加入主畫面」。" : "請開啟瀏覽器選單，選擇「安裝學習地圖」或「建立捷徑」。若沒有此選項，請更新 Chrome 或 Edge 後重試。"}</p></div>}
  </CardContent></Card>;
}
