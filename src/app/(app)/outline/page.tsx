"use client";

import { Map as MapIcon } from "lucide-react";
import { useLocalData } from "@/lib/local-data/provider";
import { PageHeader } from "@/components/layout/page-header";
import { OutlineView } from "@/components/outline/outline-view";

export default function OutlinePage() {
  const data = useLocalData();
  if (!data.ready) return <p className="text-sm text-muted-foreground">正在讀取學習地圖…</p>;
  return <div className="space-y-6"><PageHeader eyebrow="WORKSPACE" title="學習地圖" description="科目是根、節點是脈絡，錯題會顯示在它真正所屬的位置。" action={<MapIcon className="hidden size-8 text-primary/50 sm:block" />} /><OutlineView /></div>;
}
