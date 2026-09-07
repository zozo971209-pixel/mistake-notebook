"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { NodeDetail } from "@/components/outline/node-detail";

export default function OutlineNodePage() {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">正在開啟節點…</p>}><OutlineNodeContent /></Suspense>;
}

function OutlineNodeContent() {
  const id = useSearchParams().get("id") ?? "";
  return <NodeDetail nodeId={id} />;
}
