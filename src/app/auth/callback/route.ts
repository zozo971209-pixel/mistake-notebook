import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const providerError = url.searchParams.get("error_description");

  if (providerError) {
    const target = new URL("/login", url.origin);
    target.searchParams.set("error", `驗證失敗：${providerError}`);
    return NextResponse.redirect(target);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const target = new URL("/login", url.origin);
  target.searchParams.set("error", "驗證連結無效或已過期，請重新寄送驗證信。");
  return NextResponse.redirect(target);
}
