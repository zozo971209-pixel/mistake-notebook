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
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState(searchParams.get("error") ?? "");
  const [kind, setKind] = useState<"error" | "success">("error");
  const [confirmationEmail, setConfirmationEmail] = useState("");

  async function submit(formData: FormData, mode: "login" | "register") {
    setLoading(true);
    setMessage("");
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
      setKind("error");
      setMessage(
        result.error.code === "email_not_confirmed"
          ? "這個 Email 尚未驗證。請打開驗證信並點擊確認連結，或按下方按鈕重新寄送。"
          : result.error.message,
      );
      setLoading(false);
      return;
    }

    if (mode === "register" && !result.data.session) {
      setKind("success");
      setMessage("註冊成功。請打開驗證信並點擊信中的確認連結，再回來登入。");
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
      setKind("error");
      setMessage(
        error.status === 429
          ? "寄送次數太頻繁，請稍候一分鐘再試。"
          : `無法重新寄送驗證信：${error.message}`,
      );
    } else {
      setKind("success");
      setMessage("新的驗證信已寄出。請打開信件並點擊確認連結；只收到信還不算完成驗證。");
    }
    setResending(false);
  }

  return (
    <Card className="w-full max-w-md border-white/10 bg-card/90 shadow-2xl shadow-violet-950/20">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <BookOpenCheck className="size-6" />
        </div>
        <CardTitle className="text-2xl">錯題・再理解</CardTitle>
        <CardDescription>把錯誤變成下一次答對的路線圖</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登入</TabsTrigger>
            <TabsTrigger value="register">註冊</TabsTrigger>
          </TabsList>
          {message && (
            <div className="mt-4 space-y-3">
              <Alert variant={kind === "error" ? "destructive" : "default"}>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              {confirmationEmail && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={resending}
                  onClick={resendConfirmation}
                >
                  {resending ? <Loader2 className="animate-spin" /> : <MailCheck />}
                  重新寄送驗證信
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
    <form action={onSubmit} className="mt-5 space-y-4">
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
