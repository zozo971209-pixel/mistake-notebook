<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 專案驗證補充

- 調整 Android adaptive icon 時，必須重新產生 `src-tauri/icons/android` 資源，並檢查最高密度合成圖與前景透明邊界；只修改圖示設定參數不能視為完成。
- 調整手機版面比例後，必須以實際手機寬度或正式站行動版畫面驗證文字、卡片、底部導覽與水平溢位，不能只依賴桌面建置結果。
