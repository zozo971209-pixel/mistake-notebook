import { AppShell } from "@/components/layout/app-shell";
import { LocalDataProvider } from "@/lib/local-data/provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <LocalDataProvider><AppShell>{children}</AppShell></LocalDataProvider>;
}
