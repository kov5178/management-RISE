import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, AlertCircle, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const SSO_ERROR_MESSAGES: Record<string, string> = {
  sso_failed: "SSO 로그인에 실패했습니다. 다시 시도해 주세요.",
  sso_no_email: "SSO 계정에 이메일이 없습니다. 관리자에게 문의하세요.",
  sso_not_registered: "SSO 계정이 시스템에 등록되어 있지 않습니다. 관리자에게 문의하거나 사용자 등록을 요청하세요.",
  sso_pending: "승인 대기 중인 계정입니다. 관리자 승인 후 로그인 가능합니다.",
  sso_inactive: "비활성화된 계정입니다. 관리자에게 문의하세요.",
  sso_locked: "잠긴 계정입니다. 관리자에게 문의하세요.",
};

export default function Login() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const redirectTo = params.get("redirect") ?? "/";
  const ssoError = params.get("error");
  const { refetch } = useAuth();
  const login = useLogin();
  const [employeeNo, setEmployeeNo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    ssoError ? (SSO_ERROR_MESSAGES[ssoError] ?? "SSO 로그인 오류가 발생했습니다.") : null,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await login.mutateAsync({ data: { employeeNo, password } });
      await refetch();
      if (result.mustChangePassword) {
        navigate("/change-password");
      } else {
        navigate(redirectTo);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "로그인에 실패했습니다.");
    }
  };

  const handleSsoLogin = () => {
    window.location.href = `/api/login?returnTo=${encodeURIComponent(redirectTo)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <BarChart className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">RISE 성과관리</h1>
          <p className="text-sm text-muted-foreground">국립한국교통대학교</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">로그인</CardTitle>
            <CardDescription>직번/사번과 비밀번호를 입력하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeNo">직번/사번</Label>
                <Input
                  id="employeeNo"
                  placeholder="예: admin001"
                  value={employeeNo}
                  onChange={(e) => setEmployeeNo(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? "로그인 중..." : "로그인"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">또는</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleSsoLogin}
            >
              <ExternalLink className="w-4 h-4" />
              SSO 로그인
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          계정이 없으신가요?{" "}
          <a href="/register" className="text-primary underline hover:no-underline font-medium">
            사용자 등록 요청
          </a>
        </div>
      </div>
    </div>
  );
}
