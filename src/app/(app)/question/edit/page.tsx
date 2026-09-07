"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionForm } from "@/components/questions/question-form";
import { useLocalData } from "@/lib/local-data/provider";
import { Button } from "@/components/ui/button";

export default function EditQuestionPage() {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">正在讀取題目…</p>}><EditQuestionContent /></Suspense>;
}
function EditQuestionContent() {
  const id = useSearchParams().get("id") ?? "";
  const { ready, questions, subjects } = useLocalData();
  if (!ready) return <p className="text-sm text-muted-foreground">正在讀取題目…</p>;
  const question = questions.find((item) => item.id === id);
  if (!question) return <div><p>找不到題目。</p><Button asChild><Link href="/questions">回題庫</Link></Button></div>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">編輯錯題</h1><p className="mt-2 text-sm text-muted-foreground">修正題目、答案、錯因與學習節點。</p></div><QuestionForm subjects={subjects} initial={question} /></div>;
}
