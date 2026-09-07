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

GitHub 儲存庫連接 Vercel 後即可部署靜態網站；不需設定資料庫或環境變數。Gemini 請求由使用者的裝置直接送往 Google，不經本站或 Vercel。

## Android App

Android 版以 Tauri 2 封裝同一套靜態介面，支援 Android 7.0（API 24）以上的 64 位元裝置。科目、節點、錯題與複習紀錄保存在 App 的 WebView 本機資料庫；照片只在掃描期間位於記憶體，不會寫入題庫。使用者的 API Key 只保存在該裝置。

GitHub Actions 在推送 `android-v*` 標籤時建立已簽署的 arm64 APK，並附上 SHA-256 檢查碼發布至 GitHub Releases。倉庫須先設定以下 Actions secrets：

- `ANDROID_KEY_BASE64`：PKCS#12 簽署檔的 Base64 內容
- `ANDROID_KEY_PASSWORD`：簽署檔密碼
- `ANDROID_KEY_ALIAS`：簽署別名

本機已安裝 Android Studio、JDK 與 Android SDK 時，可執行：

```bash
npm run android:init
npm run android:build
```

網站與 Android App 的本機資料不會自動同步。請在「設定 → 資料與隱私」匯出 JSON，再於另一裝置匯入；API Key 不會寫入備份檔。
