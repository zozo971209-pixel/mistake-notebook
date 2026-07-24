import Link from "next/link";
import { ArrowRight, BookOpenCheck, Camera, LockKeyhole, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  { icon: Camera, title: "拍照只掃描", text: "照片只在當次辨識請求中處理，不寫入題庫或雲端檔案空間。" },
  { icon: BookOpenCheck, title: "留下真正錯因", text: "把原答案、正解和錯誤原因放在一起，回來時一眼看懂。" },
  { icon: RotateCcw, title: "安排下一次答對", text: "依答錯、困難、正確與輕鬆，自動調整熟練度與下次複習時間。" },
  { icon: LockKeyhole, title: "每人資料隔離", text: "Supabase RLS 在資料庫層限制每位使用者只能存取自己的題目。" },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3 font-semibold"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BookOpenCheck className="size-5" /></span>個人錯誤題庫</Link>
        <Button asChild variant="outline"><Link href="/login">登入</Link></Button>
      </nav>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:pt-28">
        <div>
          <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm text-primary">讓錯誤成為下一次答對的線索</span>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-primary sm:text-6xl">個人錯誤題庫</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">拍下題目、記住錯因、按時重做。把零散的錯題整理成清楚、可追蹤的學習路線。</p>
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
