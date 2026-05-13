import { useState } from "react";
import { useChangePassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, KeyRound, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "최고관리자",
  admin: "사업단 관리자",
  project_manager: "프로젝트 관리자",
  task_manager: "단위과제 담당자",
  reviewer: "검토자",
  viewer: "조회자",
};

export default function Profile() {
  const { user, refetch } = useAuth();
  const queryClient = useQueryClient();
  const changePassword = useChangePassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (next !== confirm) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (next.length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다.");
      return;
    }

    try {
      await changePassword.mutateAsync({
        data: { currentPassword: current, newPassword: next, newPasswordConfirm: confirm },
      });
      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      await queryClient.invalidateQueries();
      await refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "비밀번호 변경에 실패했습니다.");
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">내 정보</h1>
        <p className="text-muted-foreground text-sm mt-1">계정 정보를 확인하고 비밀번호를 변경할 수 있습니다.</p>
      </div>

      {/* 계정 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4" />
            계정 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground mb-1">이름</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground mb-1">직번/사번</dt>
              <dd className="font-medium font-mono">{user.employeeNo}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground mb-1">이메일</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground mb-1">권한</dt>
              <dd>
                <Badge variant="secondary" className="font-medium">
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
              </dd>
            </div>
            {user.department && (
              <div>
                <dt className="text-muted-foreground mb-1">부서</dt>
                <dd className="font-medium">{user.department}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* 비밀번호 변경 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-4 h-4" />
            비밀번호 변경
          </CardTitle>
          <CardDescription>현재 비밀번호를 확인한 후 새 비밀번호로 변경합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 text-green-700 border border-green-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">비밀번호가 성공적으로 변경되었습니다.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">현재 비밀번호</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                  className="max-w-sm"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="next">새 비밀번호</Label>
                <Input
                  id="next"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                  placeholder="4자 이상"
                  className="max-w-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">새 비밀번호 확인</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="max-w-sm"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3 max-w-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? "변경 중..." : "비밀번호 변경"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
