import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f6f2",
};

export const metadata: Metadata = {
  title: {
    default: "學習地圖",
    template: "%s｜學習地圖",
  },
  description: "自由整理主題與架構圖，讓每一道錯題連回真正需要補強的知識節點。",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/app-logo-v2-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-logo-v2-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/app-logo-v2-180.png",
  },
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
