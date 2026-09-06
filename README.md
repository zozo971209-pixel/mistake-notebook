# Learning Map

以科目架構、錯題連結與間隔複習為核心的本機優先學習網站。

## 資料與隱私

- 科目、節點、錯題與複習紀錄保存在瀏覽器 IndexedDB。
- 不需帳號，也不連接 Supabase 或其他遠端資料庫。
- 可匯出與匯入 JSON 備份；API Key 不包含在備份內。
- 題目照片只在掃描請求期間處理，不寫入 IndexedDB、伺服器檔案或物件儲存。
- Gemini 是選用功能；使用者自行提供 Key，手動流程不依賴 AI。

## 開發

```bash
npm install
npm run dev
```

不需要 `.env.local`。請勿將任何 API Key、密碼或 Token 提交到儲存庫。

## 品質檢查

```bash
npm run lint
npm run typecheck
npm run build
```

## 部署

GitHub 儲存庫連接 Vercel 後即可部署；不需設定資料庫或環境變數。Gemini 請求由同網域的 Next.js API Route 代理，Key 由瀏覽器隨單次請求送出，不會永久保存在伺服器。
