"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SubjectDetail } from "@/components/outline/subject-detail";

export default function OutlineSubjectPage() {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">正在開啟主題…</p>}><OutlineSubjectContent /></Suspense>;
}

function OutlineSubjectContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  return <SubjectDetail subjectId={id} initialReadingMode={searchParams.get("reading") === "1"} />;
}
