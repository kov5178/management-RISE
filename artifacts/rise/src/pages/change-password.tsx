import { useState } from "react";
import { useLocation } from "wouter";
import { useChangePassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

export default function ChangePassword() {
  const [, navigate] = useLocation();
  const { user, refetch } = useAuth();
  const queryClient = useQueryClient();
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isMandatory = user?.mustChangePassword === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    try {
      await changePassword.mutateAsync({
        data: { currentPassword: current, newPassword: next, newPasswordConfirm: confirm },
      });
      setSuccess(true);
      await queryClient.invalidateQueries();
      await refetch();
      setTimeout(() => navigate("/"), 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "비밀번호 변경에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">비밀번호 변경</h1>
          {isMandatory && (
            <p className="text-sm text-amber-600 font-medium">
              초기 비밀번호를 변경해야 서비스를 이용할 수 있습니다.
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">새 비밀번호 설정</CardTitle>
            <CardDescription>
              {isMandatory
                ? "보안을 위해 초기 비밀번호를 변경해 주세요."
                : "현재 비밀번호를 확인 후 새 비밀번호를 설정하세요."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <p className="font-medium">비밀번호가 변경되었습니다.</p>
                <p className="text-sm text-muted-foreground">잠시 후 대시보드로 이동합니다...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current">현재 비밀번호</Label>
                  <Input
                    id="current"
                    type="password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                    autoFocus
                    placeholder={isMandatory ? "초기 비밀번호: 1111" : "현재 비밀번호"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="next">새 비밀번호</Label>
                  <Input
                    id="next"
                    type="password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    required
                    placeholder="4자 이상"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">새 비밀번호 확인</Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={changePassword.isPending}>
                  {changePassword.isPending ? "변경 중..." : "비밀번호 변경"}
                </Button>
                {!isMandatory && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => navigate("/")}
                  >
                    취소
                  </Button>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
