import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BrainCircuit, CalendarClock, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import { QuestionActions } from "@/components/questions/question-actions";
import { AnswerStructureDisplay } from "@/components/questions/answer-structure-display";
import { parseAnswerConfig } from "@/lib/questions/answer-config";
import { AiTutor } from "@/components/questions/ai-tutor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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
      <Button asChild variant="ghost" className="-ml-3"><Link href="/questions"><ArrowLeft />回到錯題庫</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap gap-2">{subject?.name && <Badge variant="secondary">{subject.name}</Badge>}<Badge variant="outline">{question.status}</Badge>{question.is_ai_generated && <Badge><BrainCircuit />AI 協助整理</Badge>}</div><h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight">{question.title || "未命名錯題"}</h1><p className="mt-2 text-sm text-muted-foreground">{[question.chapter, question.source, question.question_type].filter(Boolean).join(" · ")}</p></div><QuestionActions id={question.id} favorite={question.is_favorite} /></div>
      <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>題目</CardTitle></CardHeader><CardContent className="space-y-5"><div className="whitespace-pre-wrap text-base leading-8">{question.question_text}</div><AnswerStructureDisplay config={answerConfig} revealCorrect /></CardContent></Card>
          <div className="grid gap-6 md:grid-cols-2"><InfoCard title="我原本的答案" content={question.original_answer} empty="尚未記錄" /><InfoCard title="正確答案" content={question.correct_answer} empty="尚未記錄" /></div>
          <InfoCard title="解題說明" content={question.solution_text} empty="尚未加入解法" />
          <Card><CardHeader><CardTitle>錯因與記憶線索</CardTitle></CardHeader><CardContent className="space-y-5"><div><p className="mb-2 text-sm text-muted-foreground">錯誤原因</p><div className="flex flex-wrap gap-2">{question.error_types.length ? question.error_types.map((item) => <Badge key={item} variant="destructive">{item}</Badge>) : <span className="text-sm text-muted-foreground">尚未分類</span>}</div></div><Separator /><div><p className="text-sm text-muted-foreground">反思</p><p className="mt-2 whitespace-pre-wrap leading-7">{question.error_note || "尚未記錄"}</p></div><div><p className="text-sm text-muted-foreground">一句話提示</p><p className="mt-2 font-medium text-primary">{question.memory_tip || "尚未記錄"}</p></div></CardContent></Card>
          <Card><CardHeader><CardTitle>最近作答</CardTitle><CardDescription>保留最近 10 次複習結果。</CardDescription></CardHeader><CardContent className="space-y-3">{!reviews?.length && <p className="text-sm text-muted-foreground">還沒有重做紀錄。</p>}{reviews?.map((review) => <div key={review.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><Badge variant={review.result === "wrong" ? "destructive" : "secondary"}>{review.result}</Badge><span className="ml-2 text-muted-foreground">{format(new Date(review.reviewed_at), "yyyy/MM/dd HH:mm", { locale: zhTW })}</span></div><span className="font-mono">{review.mastery_before} → {review.mastery_after}</span></div>)}</CardContent></Card>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
          <Card className="border-primary/20 bg-primary/5"><CardHeader><CardTitle>熟練度 {question.mastery_score}%</CardTitle><CardDescription>重做後會依結果自動更新。</CardDescription></CardHeader><CardContent><Progress value={question.mastery_score} /><div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="size-4" />下次複習：{format(new Date(question.next_review_at), "MM/dd HH:mm", { locale: zhTW })}</div><Button asChild className="mt-5 w-full"><Link href={`/review?question=${question.id}`}><RotateCcw />立即重做</Link></Button></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg">知識點</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{question.key_concepts.length ? question.key_concepts.map((item) => <Badge variant="outline" key={item}>{item}</Badge>) : <span className="text-sm text-muted-foreground">尚未標記</span>}</CardContent></Card>
        </aside>
      </section>
      <AiTutor questionId={question.id} />
    </div>
  );
}

function InfoCard({ title, content, empty }: { title: string; content: string | null; empty: string }) {
  return <Card><CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap leading-7 text-muted-foreground">{content || empty}</p></CardContent></Card>;
}
