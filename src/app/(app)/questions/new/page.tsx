"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionForm } from "@/components/questions/question-form";
import { useLocalData } from "@/lib/local-data/provider";

export default function NewQuestionPage() {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">正在開啟新增頁面…</p>}><NewQuestionContent /></Suspense>;
}
function NewQuestionContent() {
  const params = useSearchParams();
  const { ready, subjects } = useLocalData();
  if (!ready) return <p className="text-sm text-muted-foreground">正在開啟本機題庫…</p>;
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">CAPTURE → REVIEW</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">新增錯題</h1><p className="mt-2 text-sm text-muted-foreground">照片只用於本次掃描，不會存進題庫；也可以完全手動輸入。</p></div><QuestionForm subjects={subjects} defaultSubjectId={params.get("subject") ?? ""} defaultChapter={params.get("chapter") ?? ""} /></div>;
}
