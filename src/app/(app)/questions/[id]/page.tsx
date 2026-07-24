import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, RotateCcw, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { QuestionActions } from "@/components/questions/question-actions";
import { AnswerStructureDisplay } from "@/components/questions/answer-structure-display";
import { parseAnswerConfig } from "@/lib/questions/answer-config";
import { AiTutor } from "@/components/questions/ai-tutor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusLabels: Record<string, string> = { new: "新題", learning: "學習中", reviewing: "複習中", mastered: "已掌握", archived: "已封存" };

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: question }, { data: reviews }] = await Promise.all([
    supabase.from("questions").select("*,subjects(name,color)").eq("id", id).single(),
    supabase.from("review_records").select("*").eq("question_id", id).order("reviewed_at", { ascending: false }).limit(10),
  ]);
  if (!question) notFound();
  const subject = Array.isArray(question.subjects) ? question.subjects[0] : question.subjects;
  const answerConfig = parseAnswerConfig(question.answer_config);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-3"><Link href="/questions"><ArrowLeft />回到題庫</Link></Button>
      <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap gap-2">{subject?.name && <Badge variant="secondary">{subject.name}</Badge>}<Badge variant="outline">{statusLabels[question.status] ?? question.status}</Badge>{question.is_ai_generated && <Badge><Sparkles />自動整理</Badge>}</div><h1 className="mt-4 max-w-4xl text-2xl font-semibold tracking-tight sm:text-3xl">{question.title || "未命名錯題"}</h1><p className="mt-2 text-sm text-muted-foreground">{[question.chapter, question.source, question.question_type].filter(Boolean).join(" · ")}</p></div><div className="flex flex-wrap gap-2"><Button asChild><Link href={`/review?question=${question.id}`}><RotateCcw />立即重作</Link></Button><QuestionActions id={question.id} favorite={question.is_favorite} /></div></header>
      <section className="grid gap-6 xl:grid-cols-[1fr_290px]">
        <Tabs defaultValue="question"><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="question">題目</TabsTrigger><TabsTrigger value="solution">解析</TabsTrigger><TabsTrigger value="history">歷史</TabsTrigger><TabsTrigger value="helper">解題助手</TabsTrigger></TabsList>
          <TabsContent value="question" className="mt-5"><Card><CardContent className="space-y-6 p-6"><div className="whitespace-pre-wrap text-base leading-8">{question.question_text}</div><AnswerStructureDisplay config={answerConfig} /><div className="rounded-xl bg-muted/30 p-4"><p className="text-xs text-muted-foreground">我原本的答案</p><p className="mt-2 whitespace-pre-wrap leading-7">{question.original_answer || "尚未記錄"}</p></div></CardContent></Card></TabsContent>
          <TabsContent value="solution" className="mt-5 space-y-4"><AnswerBlock title="正確答案" text={question.correct_answer} /><AnswerBlock title="完整解法" text={question.solution_text} /><Card><CardContent className="space-y-4 p-5"><div><p className="text-sm font-medium">錯誤原因</p><div className="mt-2 flex flex-wrap gap-2">{question.error_types.length ? question.error_types.map((item) => <Badge key={item} variant="destructive">{item}</Badge>) : <span className="text-sm text-muted-foreground">尚未分類</span>}</div></div><div><p className="text-sm font-medium">下次提醒</p><p className="mt-2 leading-7 text-muted-foreground">{question.error_note || question.memory_tip || "尚未記錄"}</p></div></CardContent></Card></TabsContent>
          <TabsContent value="history" className="mt-5"><Card><CardContent className="p-5">{!reviews?.length ? <p className="py-8 text-center text-sm text-muted-foreground">還沒有重作紀錄。</p> : <div className="relative space-y-0 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-px before:bg-border">{reviews.map((review) => <div key={review.id} className="relative flex gap-4 py-3"><span className={`mt-1 size-3.5 shrink-0 rounded-full ring-4 ring-card ${review.result === "wrong" ? "bg-destructive" : "bg-emerald-400"}`} /><div className="flex min-w-0 flex-1 items-center justify-between gap-3"><div><p className="text-sm font-medium">{review.result === "wrong" ? "答錯" : review.result === "hard" ? "困難答對" : review.result === "easy" ? "輕鬆掌握" : "獨立答對"}</p><p className="text-xs text-muted-foreground">{format(new Date(review.reviewed_at), "yyyy/MM/dd HH:mm", { locale: zhTW })}</p></div><span className="font-mono text-sm text-muted-foreground">{review.mastery_before} → {review.mastery_after}</span></div></div>)}</div>}</CardContent></Card></TabsContent>
          <TabsContent value="helper" className="mt-5"><AiTutor questionId={question.id} /></TabsContent>
        </Tabs>
        <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start"><Card className="border-primary/20 bg-primary/5"><CardContent className="p-5"><div className="flex items-end justify-between"><div><p className="text-sm text-muted-foreground">熟練度</p><p className="mt-1 text-4xl font-semibold">{question.mastery_score}%</p></div><span className="text-xs text-muted-foreground">{statusLabels[question.status]}</span></div><Progress className="mt-4" value={question.mastery_score} /><div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="size-4" />{format(new Date(question.next_review_at), "MM/dd HH:mm", { locale: zhTW })} 複習</div></CardContent></Card><div className="rounded-xl border p-4"><p className="text-sm font-medium">知識點</p><div className="mt-3 flex flex-wrap gap-2">{question.key_concepts.length ? question.key_concepts.map((item) => <Badge variant="outline" key={item}>{item}</Badge>) : <span className="text-sm text-muted-foreground">尚未標記</span>}</div></div></aside>
      </section>
    </div>
  );
}

function AnswerBlock({ title, text }: { title: string; text: string | null }) { return <Card><CardContent className="p-5"><p className="text-sm font-medium text-primary">{title}</p><p className="mt-3 whitespace-pre-wrap leading-7 text-muted-foreground">{text || "尚未記錄"}</p></CardContent></Card>; }
