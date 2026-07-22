import { ByokSettings, GeminiGuide } from "@/components/settings/byok-settings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageOff } from "lucide-react";

export const metadata = { title: "AI 與設定" };

export default function SettingsPage() {
  return <div className="space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight">AI 與設定</h1><p className="mt-2 text-muted-foreground">管理自己的 API Key、了解隱私界線，並匯出個人資料。</p></div><Alert><ImageOff /><AlertTitle>圖片政策：僅掃描，不保存</AlertTitle><AlertDescription>本站不建立 R2 或圖片 Bucket。圖片只在瀏覽器壓縮後傳到當次 API 請求，伺服器以記憶體轉送 AI，完成後不寫入磁碟或資料庫。AI 服務商仍可能依其條款與安全政策處理或保留請求資料，請先遮住姓名、學號與班級。</AlertDescription></Alert><Tabs defaultValue="key"><TabsList><TabsTrigger value="key">API Key 與匯出</TabsTrigger><TabsTrigger value="guide">免費 API 申請教學</TabsTrigger></TabsList><TabsContent value="key" className="mt-5"><ByokSettings /></TabsContent><TabsContent value="guide" className="mt-5"><GeminiGuide /></TabsContent></Tabs></div>;
}
