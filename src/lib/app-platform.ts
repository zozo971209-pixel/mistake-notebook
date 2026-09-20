"use client";

import { useEffect, useSyncExternalStore } from "react";

export type AppPlatform = "web" | "android" | "windows";

const subscribe = () => () => undefined;

export function detectAppPlatform(): AppPlatform {
  if (typeof window === "undefined") return "web";
  if (process.env.NODE_ENV === "development") {
    const requestedPreview = new URLSearchParams(window.location.search).get("platform");
    if (requestedPreview) window.sessionStorage.setItem("learning-map-platform-preview", requestedPreview);
    const preview = requestedPreview ?? window.sessionStorage.getItem("learning-map-platform-preview");
    if (preview === "windows" || preview === "android" || preview === "web") return preview;
  }
  if (!("__TAURI_INTERNALS__" in window)) return "web";
  return /Android/i.test(window.navigator.userAgent) ? "android" : "windows";
}

export function useAppPlatform() {
  const platform = useSyncExternalStore(subscribe, detectAppPlatform, () => "web" as const);

  useEffect(() => {
    document.documentElement.dataset.appPlatform = platform;
    return () => {
      delete document.documentElement.dataset.appPlatform;
    };
  }, [platform]);

  return platform;
}
