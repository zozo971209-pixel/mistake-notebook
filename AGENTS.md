<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 專案驗證補充

- 調整 Android adaptive icon 時，必須重新產生 `src-tauri/icons/android` 資源，並檢查最高密度合成圖與前景透明邊界；只修改圖示設定參數不能視為完成。
- 調整手機版面比例後，必須以實際手機寬度或正式站行動版畫面驗證文字、卡片、底部導覽與水平溢位，不能只依賴桌面建置結果。
- 除非使用者明確要求，不主動開啟瀏覽器或執行可由使用者自行完成的介面操作測試；仍應執行與程式正確性直接相關的 lint、typecheck、build 或封裝檢查，並把實機介面結果標為未確認。
- 編輯器載入或貼上外部 HTML 時，必須保留文字但移除 `javascript:` 等不安全連結；閱讀模式中的文字點擊不得導離 Tauri WebView。
- Tauri 桌面版匯出備份必須用原生寫檔並回傳實際路徑；任何取代或清除資料操作，都要等待備份成功後才能繼續。
- 只有使用者在當次要求中明確說要同步 E 槽時，才能寫入或更新 `E:\專案\mistake-notebook`；不得沿用較早回合的同步授權。
