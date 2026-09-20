"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { NodeDetail } from "@/components/outline/node-detail";

export default function OutlineNodePage() {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">正在開啟節點…</p>}><OutlineNodeContent /></Suspense>;
}

function OutlineNodeContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const requestedReturnTo = searchParams.get("returnTo") ?? "";
  const returnTo = requestedReturnTo.startsWith("/outline?") ? requestedReturnTo : "/outline";
  return <NodeDetail nodeId={id} initialReadingMode={searchParams.get("reading") === "1"} returnTo={returnTo} />;
}
