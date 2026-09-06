"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ReviewSession } from "@/components/review/review-session";
import { useLocalData, withSubject } from "@/lib/local-data/provider";

export default function ReviewPage() {
  return <Suspense fallback={<p className="text-sm text-muted-foreground">正在準備複習…</p>}><ReviewContent /></Suspense>;
}
function ReviewContent() {
  const params = useSearchParams();
  const { ready, questions, subjects, settings } = useLocalData();
  const [currentTime] = useState(() => Date.now());
  if (!ready) return <p className="text-sm text-muted-foreground">正在準備複習…</p>;
  const selectedId = params.get("question");
  const active = questions.filter((item) => item.status !== "archived");
  const selected = selectedId
    ? active.filter((item) => item.id === selectedId)
    : active.filter((item) => Date.parse(item.next_review_at) <= currentTime).sort((a, b) => a.mastery_score - b.mastery_score).slice(0, settings.daily_review_target);
  const fallback = selected.length || selectedId ? selected : [...active].sort((a, b) => a.mastery_score - b.mastery_score).slice(0, Math.min(10, settings.daily_review_target));
  return <div className="space-y-6"><PageHeader title="複習" description="先獨立作答，再揭曉答案。" /><ReviewSession initialQuestions={fallback.map((item) => withSubject(item, subjects))} /></div>;
}
