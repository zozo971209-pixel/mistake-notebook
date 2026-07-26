"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpenCheck, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialNotice = searchParams.get("notice");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState(initialNotice ?? searchParams.get("error") ?? "");
  const [kind, setKind] = useState<"error" | "success">(initialNotice ? "success" : "error");
  const [activeTab, setActiveTab] = useState("login");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [emailRateLimited, setEmailRateLimited] = useState(false);

  async function submit(formData: FormData, mode: "login" | "register") {
    setLoading(true);
    setMessage("");
    setShowResend(false);
    setEmailRateLimited(false);
    const supabase = createClient();
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    setConfirmationEmail(email);

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
              data: { display_name: String(formData.get("displayName") ?? "新使用者") },
            },
          });

    if (result.error) {
      const isEmailRateLimit =
        result.error.status === 429 ||
        result.error.code === "over_email_send_rate_limit" ||
        result.error.message.toLowerCase().includes("email rate limit");
      const isUnconfirmed = result.error.code === "email_not_confirmed";

      setKind("error");
      setMessage(
        isEmailRateLimit
          ? "目前已達 Supabase 免費寄信上限（整個網站每小時 2 封）。請不要重複註冊或重寄，約一小時後再試一次，並檢查垃圾郵件。"
          : isUnconfirmed
          ? "這個 Email 尚未驗證。請打開驗證信並點擊確認連結，或按下方按鈕重新寄送。"
          : result.error.message,
      );
      setShowResend(isEmailRateLimit || isUnconfirmed);
      setEmailRateLimited(isEmailRateLimit);
      setLoading(false);
      return;
    }

    if (mode === "register" && result.data.user?.identities?.length === 0) {
      setKind("success");
      setMessage("這個 Email 已經註冊。請直接使用原本的密碼登入；如果忘記密碼，之後可使用重設密碼功能。");
      setActiveTab("login");
      setLoading(false);
      return;
    }

    if (mode === "register" && !result.data.session) {
      setKind("success");
      setMessage("註冊成功。請打開驗證信並點擊信中的確認連結，再回來登入。");
      setShowResend(true);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  async function resendConfirmation() {
    if (!confirmationEmail) {
      setKind("error");
      setMessage("請先在登入或註冊欄位輸入你的 Email。");
      return;
    }

    setResending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: confirmationEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      const isEmailRateLimit =
        error.status === 429 ||
        error.code === "over_email_send_rate_limit" ||
        error.message.toLowerCase().includes("email rate limit");
      setKind("error");
      setMessage(
        isEmailRateLimit
          ? "目前已達 Supabase 免費寄信上限（整個網站每小時 2 封）。請約一小時後再試，現在重複點擊不會寄出新信。"
          : `無法重新寄送驗證信：${error.message}`,
      );
      setEmailRateLimited(isEmailRateLimit);
    } else {
      setKind("success");
      setMessage("新的驗證信已寄出。請打開信件並點擊確認連結；只收到信還不算完成驗證。");
    }
    setResending(false);
  }

  return (
    <Card className="w-full max-w-md border-border bg-card/95 shadow-[0_24px_70px_rgb(55_48_163_/_0.12)]">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <BookOpenCheck className="size-6" />
        </div>
        <CardTitle className="text-2xl">個人錯誤題庫</CardTitle>
        <CardDescription>登入後繼續整理與複習</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-col gap-4">
          <TabsList className="grid h-10 w-full grid-cols-2">
            <TabsTrigger value="login">登入</TabsTrigger>
            <TabsTrigger value="register">註冊</TabsTrigger>
          </TabsList>
          {message && (
            <div className="mt-4 space-y-3">
              <Alert variant={kind === "error" ? "destructive" : "default"}>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              {showResend && confirmationEmail && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={resending || emailRateLimited}
                  onClick={resendConfirmation}
                >
                  {resending ? <Loader2 className="animate-spin" /> : <MailCheck />}
                  {emailRateLimited ? "寄信暫時受限（約一小時）" : "重新寄送驗證信"}
                </Button>
              )}
            </div>
          )}
          <TabsContent value="login">
            <AuthFields loading={loading} onSubmit={(data) => submit(data, "login")} />
          </TabsContent>
          <TabsContent value="register">
            <AuthFields registration loading={loading} onSubmit={(data) => submit(data, "register")} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function AuthFields({
  registration = false,
  loading,
  onSubmit,
}: {
  registration?: boolean;
  loading: boolean;
  onSubmit: (data: FormData) => Promise<void>;
}) {
  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(new FormData(event.currentTarget));
      }}
    >
      {registration && (
        <div className="space-y-2">
          <Label htmlFor="displayName">顯示名稱</Label>
          <Input id="displayName" name="displayName" maxLength={50} placeholder="你的名字" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={registration ? "register-email" : "login-email"}>Email</Label>
        <Input id={registration ? "register-email" : "login-email"} name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={registration ? "register-password" : "login-password"}>密碼</Label>
        <Input id={registration ? "register-password" : "login-password"} name="password" type="password" minLength={8} autoComplete={registration ? "new-password" : "current-password"} required />
      </div>
      <Button className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        {registration ? "建立帳號" : "登入"}
      </Button>
    </form>
  );
}
