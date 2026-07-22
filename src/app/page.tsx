import Link from "next/link";
import { ArrowRight, BrainCircuit, Camera, LockKeyhole, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  { icon: Camera, title: "拍照只掃描", text: "照片只在當次辨識請求中處理，不寫入題庫或雲端檔案空間。" },
  { icon: BrainCircuit, title: "AI 找出盲點", text: "擷取題目、整理知識點，並以提示或蘇格拉底方式陪你拆解錯誤。" },
  { icon: RotateCcw, title: "安排下一次答對", text: "依答錯、困難、正確與輕鬆，自動調整熟練度與下次複習時間。" },
  { icon: LockKeyhole, title: "每人資料隔離", text: "Supabase RLS 在資料庫層限制每位使用者只能存取自己的題目。" },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3 font-semibold"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BrainCircuit className="size-5" /></span>錯題・再理解</Link>
        <Button asChild variant="outline"><Link href="/login">登入</Link></Button>
      </nav>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:pt-28">
        <div>
          <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm text-primary">個人 AI 錯題學習系統</span>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">不是收藏錯題，<br /><span className="text-primary">是讓錯誤不再發生。</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">掃描題目、記錄錯因、重新作答，讓每一次失誤都轉化成可追蹤的理解。原始照片不保存，核心題庫沒有 AI 也能使用。</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/login">開始建立題庫<ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="ghost"><Link href="/login">我已有帳號</Link></Button>
          </div>
        </div>
        <Card className="overflow-hidden border-primary/15 bg-card/70 shadow-2xl shadow-violet-950/30">
          <CardContent className="p-4 sm:p-6">
            <div className="rounded-xl border bg-background/60 p-5">
              <p className="text-xs text-muted-foreground">今日學習焦點</p>
              <p className="mt-2 text-2xl font-semibold">先理解「為什麼錯」</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {["待複習 12", "本週正確率 78%", "已掌握 46"].map((item) => <div key={item} className="rounded-lg border bg-card p-3 text-sm">{item}</div>)}
              </div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-3/4 rounded-full bg-primary" /></div>
              <p className="mt-2 text-xs text-muted-foreground">今日目標 15 / 20 題</p>
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, text }) => <Card key={title} className="bg-card/55"><CardContent className="p-5"><Icon className="size-5 text-primary" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>)}
      </section>
    </main>
  );
}
