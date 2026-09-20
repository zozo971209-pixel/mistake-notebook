import Image from "next/image";

export function AppLogo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return <Image src="/app-logo-v2-512.png" alt="學習地圖" width={size} height={size} priority className={`shrink-0 ${className}`} />;
}
