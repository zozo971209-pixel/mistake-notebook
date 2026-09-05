import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "個人錯誤題庫",
    template: "%s｜個人錯誤題庫",
  },
  description: "把拍下來的錯題轉成可搜尋、可重做、會安排複習的個人學習系統。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
