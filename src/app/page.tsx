import Link from "next/link";
import { ArrowRight, BookOpenCheck, Camera, FolderTree, HardDrive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  { icon: FolderTree, title: "自由建立架構", text: "自訂科目與多層節點，點開即可查看內容和相關錯題。" },
  { icon: BookOpenCheck, title: "匯入錯題記錄", text: "透過手動輸入、照片掃描或備份檔，把既有錯題整理到對應科目與知識節點。" },
  { icon: Camera, title: "照片只掃描", text: "照片只在本次辨識期間處理，不會寫入題庫或檔案空間。" },
  { icon: HardDrive, title: "資料留在裝置", text: "不需註冊、不連資料庫；可用備份檔自行搬移到其他裝置。" },
];

export default function Home() {
  return <main className="min-h-screen"><nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6"><Link href="/" className="flex items-center gap-3 font-semibold"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><FolderTree className="size-5" /></span>學習地圖</Link><Button asChild variant="outline"><Link href="/dashboard">開啟工作區</Link></Button></nav><section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:pt-28"><div><span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm text-primary">把零散錯題放回完整知識脈絡</span><h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-primary sm:text-6xl">建立專屬於你的學習地圖</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">自由編排科目結構、匯入錯題、練習與追蹤熟練度。核心功能完全保存在目前裝置，AI 只在你需要時啟用。</p><div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/dashboard">開始使用<ArrowRight /></Link></Button><Button asChild size="lg" variant="ghost"><Link href="/outline">先建立科目架構</Link></Button></div></div><Card className="overflow-hidden border-primary/15 bg-card shadow-[0_24px_70px_rgb(55_48_163_/_0.12)]"><CardContent className="p-6"><div className="rounded-2xl border bg-background/60 p-5"><p className="text-xs text-muted-foreground">你的學習結構</p><div className="mt-5 space-y-3"><MapRow label="數學" child="函數 → 二次函數" color="#7c3aed" /><MapRow label="英文" child="文法 → 關係子句" color="#2563eb" /><MapRow label="地科" child="地質 → 板塊運動" color="#4f46e5" /></div><div className="mt-6 flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-sm text-primary"><RotateCcw className="size-4" />節點下直接開始重作錯題</div></div></CardContent></Card></section><section className="mx-auto grid max-w-7xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">{features.map(({ icon: Icon, title, text }) => <Card key={title}><CardContent className="p-5"><Icon className="size-5 text-primary" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>)}</section></main>;
}
function MapRow({ label, child, color }: { label: string; child: string; color: string }) { return <div className="flex items-center gap-3 rounded-xl border bg-card p-3"><span className="size-3 rounded-full" style={{ backgroundColor: color }} /><strong className="w-12 text-sm">{label}</strong><span className="text-sm text-muted-foreground">{child}</span></div>; }
