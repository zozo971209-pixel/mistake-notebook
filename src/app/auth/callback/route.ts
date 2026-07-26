import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const providerError = url.searchParams.get("error_description");
  const supabase = await createClient();

  if (providerError) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return NextResponse.redirect(new URL(next, url.origin));
    const target = new URL("/login", url.origin);
    const isExpired = /expired|invalid|otp/i.test(providerError);
    target.searchParams.set(
      isExpired ? "notice" : "error",
      isExpired
        ? "這個驗證連結已失效。如果你現在能正常登入，代表帳號已完成註冊，直接登入即可；只有登入顯示「Email 尚未驗證」時才需要重寄。"
        : `驗證失敗：${providerError}`,
    );
    return NextResponse.redirect(target);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return NextResponse.redirect(new URL(next, url.origin));
  }

  const target = new URL("/login", url.origin);
  target.searchParams.set("notice", "驗證連結已失效。請先嘗試登入；如果可以登入就不需要再次驗證，只有登入顯示 Email 尚未驗證時才重新寄送。");
  return NextResponse.redirect(target);
}
