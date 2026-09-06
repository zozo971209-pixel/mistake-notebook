"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, Heart, Plus, Search } from "lucide-react";
import { useLocalData } from "@/lib/local-data/provider";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionBankAI } from "@/components/questions/question-bank-ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const statusLabels: Record<string, string> = { new: "新題", learning: "學習中", reviewing: "複習中", mastered: "已掌握", archived: "已封存" };
export default function QuestionsPage() {
  const { ready, questions, subjects } = useLocalData();
  const [query, setQuery] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [status, setStatus] = useState("");
  const [currentTime] = useState(() => Date.now());
  const filtered = useMemo(() => questions.filter((question) => {
    if (!status && question.status === "archived") return false;
    if (status && question.status !== status) return false;
    if (subjectId && question.subject_id !== subjectId) return false;
    return `${question.title ?? ""} ${question.question_text} ${question.chapter ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
  }).slice(0, 300), [questions, query, subjectId, status]);
  if (!ready) return <p className="text-sm text-muted-foreground">正在讀取本機題庫…</p>;

  return <div className="space-y-6">
    <PageHeader eyebrow="CAPTURE & REVIEW" title="錯題庫" description="搜尋、重作，或把題目連到學習地圖的節點。" action={<Button asChild><Link href="/questions/new"><Plus />新增錯題</Link></Button>} />
    <QuestionBankAI questions={questions} subjects={subjects} />
    <div className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[1fr_180px]">
      <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜尋題目、標題或節點" /></div>
      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">全部科目</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
      <div className="flex flex-wrap gap-2 md:col-span-2">{[["", "全部"], ["new", "新題"], ["learning", "學習中"], ["reviewing", "待複習"], ["mastered", "已掌握"]].map(([value, label]) => <Button key={value} size="sm" variant={status === value ? "default" : "outline"} onClick={() => setStatus(value)}>{label}</Button>)}</div>
    </div>
    {filtered.length === 0 ? <div className="rounded-2xl border border-dashed p-12 text-center"><BookOpen className="mx-auto size-8 text-muted-foreground" /><p className="mt-4 font-medium">找不到符合條件的錯題</p><p className="mt-2 text-sm text-muted-foreground">調整篩選，或新增一題。</p></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((question) => {
      const subject = subjects.find((item) => item.id === question.subject_id);
      const due = Date.parse(question.next_review_at) <= currentTime;
      return <Link key={question.id} href={`/questions/${question.id}`} className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/30"><span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: subject?.color ?? "#4f46e5" }} /><div className="flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2">{subject && <Badge variant="secondary">{subject.name}</Badge>}<Badge variant="outline">{statusLabels[question.status]}</Badge>{due && question.status !== "mastered" && <span className="mt-1 size-2 rounded-full bg-amber-500" />}</div>{question.is_favorite && <Heart className="size-4 fill-current text-rose-500" />}</div><h2 className="mt-4 line-clamp-2 font-semibold leading-6">{question.title || question.question_text}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{question.question_text}</p><div className="mt-5 flex items-center justify-between text-xs text-muted-foreground"><span>{question.chapter || "未連結節點"}</span><span className="font-mono text-primary">{question.mastery_score}%</span></div><Progress className="mt-2 h-1.5" value={question.mastery_score} /></Link>;
    })}</div>}
  </div>;
}
