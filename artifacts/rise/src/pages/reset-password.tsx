import { useState } from "react";
import { Link } from "wouter";
import {
  useRequestPasswordReset,
  useConfirmPasswordReset,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { BarChart, AlertCircle, CheckCircle2, Mail, ArrowLeft } from "lucide-react";

type Step = "identity" | "otp" | "done";

export default function ResetPassword() {
  const [step, setStep] = useState<Step>("identity");
  const [maskedEmail, setMaskedEmail] = useState("");

  // Step 1 fields
  const [employeeNo, setEmployeeNo] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  // Step 2 fields
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [error, setError] = useState<string | null>(null);

  const requestReset = useRequestPasswordReset();
  const confirmReset = useConfirmPasswordReset();

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await requestReset.mutateAsync({
        data: { employeeNo, name, email, currentPassword },
      });
      setMaskedEmail(result.maskedEmail ?? "");
      setStep("otp");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "요청에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await confirmReset.mutateAsync({
        data: { employeeNo, otp, newPassword, newPasswordConfirm },
      });
      setStep("done");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "비밀번호 변경에 실패했습니다.");
    }
  };

  const handleResend = async () => {
    setError(null);
    setOtp("");
    try {
      const result = await requestReset.mutateAsync({
        data: { employeeNo, name, email, currentPassword },
      });
      setMaskedEmail(result.maskedEmail ?? "");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "인증코드 재발송에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <BarChart className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">RISE 성과관리</h1>
          <p className="text-sm text-muted-foreground">국립한국교통대학교</p>
        </div>

        {/* Step 1: 신원 확인 */}
        {step === "identity" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">초기 비밀번호 변경</CardTitle>
              <CardDescription>
                직번/사번, 이름, 이메일, 임시 비밀번호를 입력해 신원을 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleIdentitySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeNo">직번/사번</Label>
                  <Input
                    id="employeeNo"
                    placeholder="예: emp001"
                    value={employeeNo}
                    onChange={(e) => setEmployeeNo(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    placeholder="등록된 이름"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="등록된 이메일"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">임시 비밀번호</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="발급받은 임시 비밀번호"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={requestReset.isPending}
                >
                  {requestReset.isPending ? "확인 중..." : "인증코드 받기"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: OTP + 새 비밀번호 */}
        {step === "otp" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="w-5 h-5" />
                이메일 인증
              </CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">{maskedEmail}</span>
                {" "}으로 발송된 6자리 인증코드를 입력하세요.
                <br />
                <span className="text-xs">코드는 10분간 유효합니다.</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">인증코드 (6자리)</Label>
                  <Input
                    id="otp"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                    inputMode="numeric"
                    maxLength={6}
                    className="text-center text-xl tracking-widest font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">새 비밀번호</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="4자 이상 (직번·1111 제외)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPasswordConfirm">새 비밀번호 확인</Label>
                  <Input
                    id="newPasswordConfirm"
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={confirmReset.isPending}
                >
                  {confirmReset.isPending ? "변경 중..." : "비밀번호 변경"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={handleResend}
                  disabled={requestReset.isPending}
                >
                  {requestReset.isPending ? "재발송 중..." : "인증코드 재발송"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => { setStep("identity"); setError(null); }}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  정보 다시 입력
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Done */}
        {step === "done" && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <CheckCircle2 className="w-14 h-14 text-green-500" />
                <div className="space-y-1">
                  <p className="text-lg font-bold">비밀번호가 변경되었습니다</p>
                  <p className="text-sm text-muted-foreground">
                    새 비밀번호로 로그인해 주세요.
                  </p>
                </div>
                <Link href="/login">
                  <Button className="mt-2">로그인 화면으로</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 로그인으로 돌아가기 */}
        {step !== "done" && (
          <div className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-primary underline hover:no-underline font-medium"
            >
              <ArrowLeft className="w-3 h-3" />
              로그인으로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
