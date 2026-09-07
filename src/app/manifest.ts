import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "學習地圖",
    short_name: "學習地圖",
    description: "自由整理科目架構、錯題與複習進度。",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#ea580c",
    icons: [{ src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
