import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "學習地圖",
    short_name: "學習地圖",
    description: "自由整理主題、架構圖、錯題與複習進度。",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#ea580c",
    icons: [
      { src: "/app-logo-v2-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-logo-v2-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-logo-v2-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
