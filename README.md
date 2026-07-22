# Mistake Notebook

一個以錯因診斷與間隔複習為核心的個人錯題網站。使用者可掃描題目、修正辨識結果、整理錯因、重新作答、查看學習統計，並用 Gemini 取得提示或教學。

## 隱私設計

- 題目圖片只在掃描請求期間存在於瀏覽器與伺服器記憶體。
- 圖片不寫入 Supabase、檔案系統或物件儲存空間。
- 資料庫只保存使用者確認後的文字、錯因、答案與複習紀錄。
- 自備 Gemini API Key 預設只保存在目前分頁；使用者主動選擇後才保存在該裝置。

## 技術架構

- Next.js App Router、TypeScript、Tailwind CSS
- Supabase Auth、PostgreSQL、Row Level Security
- Gemini API（網站共用額度或 BYOK）
- Vercel 部署

## 本機設定

1. 安裝依賴：`npm install`
2. 複製 `.env.example` 為 `.env.local`
3. 填入 Supabase 公開設定；若要提供網站共用 AI 額度，再填入 `GEMINI_API_KEY`
4. 啟動：`npm run dev`

環境變數：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

請勿提交 `.env.local`、資料庫密碼、Supabase Secret Key 或 Gemini API Key。

## 資料庫

所有資料庫變更均位於 `supabase/migrations/`，包括完整資料表、RLS、預設科目、AI 額度與原子化複習紀錄函式。

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

## 品質檢查

```bash
npm run typecheck
npm run lint
npm run build
npm audit
```

## 部署

將 GitHub 儲存庫連接 Vercel，加入相同環境變數後部署。部署完成後，需把正式網址加入 Supabase Authentication 的 Site URL 與 Redirect URLs。
