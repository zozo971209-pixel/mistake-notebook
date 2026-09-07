"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SubjectDetail } from "@/components/outline/subject-detail";

export default function OutlineSubjectPage() {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">正在開啟科目…</p>}><OutlineSubjectContent /></Suspense>;
}

function OutlineSubjectContent() {
  const id = useSearchParams().get("id") ?? "";
  return <SubjectDetail subjectId={id} />;
}
