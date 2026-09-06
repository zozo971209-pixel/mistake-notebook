import { ByokSettings, GeminiGuide } from "@/components/settings/byok-settings";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = { title: "設定" };

export default function SettingsPage() {
  return <div className="space-y-6"><PageHeader title="設定" description="管理本機資料、備份與選用的 AI 功能。" /><Tabs defaultValue="data"><TabsList className="scrollbar-hidden w-full justify-start overflow-x-auto md:overflow-visible"><TabsTrigger value="data">資料與隱私</TabsTrigger><TabsTrigger value="service">API Key</TabsTrigger><TabsTrigger value="guide">申請教學</TabsTrigger></TabsList><TabsContent value="data" className="mt-5"><ByokSettings section="data" /></TabsContent><TabsContent value="service" className="mt-5"><ByokSettings section="key" /></TabsContent><TabsContent value="guide" className="mt-5"><GeminiGuide /></TabsContent></Tabs></div>;
}
