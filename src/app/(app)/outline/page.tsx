"use client";

import { Map as MapIcon } from "lucide-react";
import { useLocalData } from "@/lib/local-data/provider";
import { useAppPlatform } from "@/lib/app-platform";
import { PageHeader } from "@/components/layout/page-header";
import { OutlineView } from "@/components/outline/outline-view";

export default function OutlinePage() {
  const data = useLocalData();
  const platform = useAppPlatform();
  if (!data.ready) return <p className="text-sm text-muted-foreground">正在讀取學習地圖…</p>;
  return <div className={platform === "windows" ? "space-y-4" : "space-y-6"}>{platform !== "windows" && <PageHeader title="學習地圖" description="以可拖曳的心智圖整理主題、架構圖、知識脈絡與錯題。" action={<MapIcon className="hidden size-8 text-primary/50 sm:block" />} />}<OutlineView /></div>;
}
