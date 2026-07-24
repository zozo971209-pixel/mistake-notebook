import { ByokSettings, GeminiGuide } from "@/components/settings/byok-settings";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = { title: "設定" };

export default function SettingsPage() {
  return <div className="space-y-6"><PageHeader title="設定" description="管理解題服務、個人資料與隱私。" /><Tabs defaultValue="service"><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="service">解題服務</TabsTrigger><TabsTrigger value="data">資料與隱私</TabsTrigger><TabsTrigger value="guide">申請教學</TabsTrigger></TabsList><TabsContent value="service" className="mt-5"><ByokSettings section="key" /></TabsContent><TabsContent value="data" className="mt-5 space-y-5"><details className="rounded-xl border bg-card/40"><summary className="cursor-pointer list-none p-4 font-medium">照片如何處理？</summary><div className="border-t p-4 text-sm leading-6 text-muted-foreground">照片只在掃描期間處理，不會寫入題庫或檔案空間。掃描前請遮住姓名、學號與班級。</div></details><ByokSettings section="data" /></TabsContent><TabsContent value="guide" className="mt-5"><GeminiGuide /></TabsContent></Tabs></div>;
}
