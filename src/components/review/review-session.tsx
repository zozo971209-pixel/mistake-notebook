"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Eye, Lightbulb, RotateCcw, X } from "lucide-react";
import type { Tables } from "@/types/database";
import { recordReviewAction } from "@/app/(app)/review/actions";
import { evaluateStructuredAnswer, formatStructuredAnswer, parseAnswerConfig } from "@/lib/questions/answer-config";
import { StructuredAnswerInput } from "@/components/questions/structured-answer";
import { AnswerStructureDisplay } from "@/components/questions/answer-structure-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

type ReviewQuestion = Tables<"questions"> & { subjects: { name: string; color: string } | null };
type Result = "wrong" | "hard" | "correct" | "easy";

export function ReviewSession({ initialQuestions }: { initialQuestions: ReviewQuestion[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [blankValues, setBlankValues] = useState<string[]>([]);
  const [usedHint, setUsedHint] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const question = questions[index];
  const answerConfig = parseAnswerConfig(question?.answer_config);
  const structuredResult = evaluateStructuredAnswer(answerConfig, selectedIds, blankValues);
  const progress = questions.length ? (index / questions.length) * 100 : 0;
  const remaining = useMemo(() => Math.max(0, questions.length - index), [questions.length, index]);

  async function grade(result: Result) {
    if (!question) return;
    setBusy(true);
    const submittedAnswer = answerConfig.kind === "fill_blank" ? blankValues.join("｜") : formatStructuredAnswer(answerConfig, selectedIds, answer);
    const response = await recordReviewAction({ questionId: question.id, result, answer: submittedAnswer, usedHint, durationSeconds: startedAt ? (Date.now() - startedAt) / 1000 : 0 });
    setBusy(false);
    if (response.error) return setMessage(response.error);
    if (result === "wrong") setQuestions((current) => [...current, question]);
    setIndex((current) => current + 1);
    setRevealed(false);
    setAnswer("");
    setSelectedIds([]);
    setBlankValues([]);
    setUsedHint(false);
    setStartedAt(0);
    setMessage("");
  }

  if (!question) {
    return <Card className="mx-auto max-w-2xl border-primary/20"><CardContent className="p-10 text-center"><Check className="mx-auto size-12 rounded-full bg-emerald-500/15 p-3 text-emerald-400" /><h2 className="mt-5 text-2xl font-semibold">這一輪完成了</h2><p className="mt-2 text-muted-foreground">你已處理所有待複習題目。答錯的題目也已安排再次出現。</p><div className="mt-6 flex justify-center gap-3"><Button asChild variant="outline"><Link href="/dashboard">回總覽</Link></Button><Button asChild><Link href="/questions">查看題庫</Link></Button></div></CardContent></Card>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>本輪進度</span><span>還有 {remaining} 題</span></div>
      <Progress value={progress} />
      <Card>
        <CardHeader><div className="flex flex-wrap items-center gap-2">{question.subjects?.name && <Badge variant="secondary">{question.subjects.name}</Badge>}<Badge variant="outline">熟練度 {question.mastery_score}%</Badge></div><CardTitle className="pt-3">{question.title || "重新作答"}</CardTitle><CardDescription>{question.chapter || "先獨立完成，再揭曉答案。"}</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-5 rounded-xl border bg-background/50 p-5"><div className="whitespace-pre-wrap leading-8">{question.question_text}</div><AnswerStructureDisplay config={answerConfig} /></div>
          {question.memory_tip && !revealed && <Button variant="ghost" size="sm" onClick={() => setUsedHint(true)}><Lightbulb />{usedHint ? question.memory_tip : "顯示一層提示"}</Button>}
          {!revealed && <StructuredAnswerInput config={answerConfig} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} writtenAnswer={answer} onWrittenAnswerChange={setAnswer} blankValues={blankValues} onBlankValuesChange={setBlankValues} onStart={() => { if (!startedAt) setStartedAt(Date.now()); }} />}
          {!revealed ? <Button className="w-full" size="lg" onClick={() => { if (!startedAt) setStartedAt(Date.now()); setRevealed(true); }}><Eye />揭曉答案並自我評分</Button> : <div className="space-y-5">{structuredResult !== null && <Alert variant={structuredResult ? "default" : "destructive"}><AlertDescription className="font-medium">{structuredResult ? (answerConfig.kind === "mixed" ? "選擇部分答對了；請再核對文字補充。" : "答案比對正確。") : (answerConfig.kind === "mixed" ? "選擇部分與設定答案不同，請查看下方正解。" : "答案與設定正解不同，請查看下方解析。")}</AlertDescription></Alert>}<div className="rounded-xl border bg-muted/10 p-4"><p className="mb-3 text-sm font-medium text-primary">題型答案</p><AnswerStructureDisplay config={answerConfig} revealCorrect /></div><div className="grid gap-4 md:grid-cols-2"><Answer title="我的作答" text={answerConfig.kind === "fill_blank" ? blankValues.join("｜") : formatStructuredAnswer(answerConfig, selectedIds, answer)} /><Answer title="答案補充與解題說明" text={[question.correct_answer, question.solution_text].filter(Boolean).join("\n\n")} /></div><div className="flex items-center gap-2"><Checkbox id="hint" checked={usedHint} onCheckedChange={(value) => setUsedHint(Boolean(value))} /><label htmlFor="hint" className="text-sm font-medium">這題有使用提示</label></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><GradeButton label="答錯" icon={X} variant="destructive" onClick={() => grade("wrong")} disabled={busy} /><GradeButton label="困難答對" icon={RotateCcw} variant="outline" onClick={() => grade("hard")} disabled={busy} /><GradeButton label="獨立答對" icon={Check} variant="secondary" onClick={() => grade("correct")} disabled={busy} /><GradeButton label="輕鬆掌握" icon={ChevronRight} variant="default" onClick={() => grade("easy")} disabled={busy} /></div></div>}
          {message && <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>}
        </CardContent>
      </Card>
    </div>
  );
}

function Answer({ title, text }: { title: string; text: string | null }) {
  return <div className="rounded-xl border bg-muted/20 p-4"><p className="text-sm font-medium text-primary">{title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{text || "尚未記錄"}</p></div>;
}

function GradeButton({ label, icon: Icon, variant, onClick, disabled }: { label: string; icon: typeof Check; variant: "destructive" | "outline" | "secondary" | "default"; onClick: () => void; disabled: boolean }) {
  return <Button variant={variant} onClick={onClick} disabled={disabled}><Icon />{label}</Button>;
}
