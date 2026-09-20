"use client";

export async function openExternalUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("只允許開啟 HTTPS 網址。");

  if ("__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_external_url", { url: parsed.toString() });
    return;
  }

  const opened = window.open(parsed.toString(), "_blank", "noopener,noreferrer");
  if (!opened) throw new Error("瀏覽器阻擋了新分頁。");
}
