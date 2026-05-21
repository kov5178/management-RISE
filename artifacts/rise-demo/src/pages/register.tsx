import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateRegistrationRequest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, AlertCircle, CheckCircle } from "lucide-react";

export default function Register() {
  const [, navigate] = useLocation();
  const createRequest = useCreateRegistrationRequest();

  const [form, setForm] = useState({
    employeeNo: "",
    email: "",
    name: "",
    department: "",
    position: "",
    password: "",
    passwordConfirm: "",
    requestReason: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    try {
      await createRequest.mutateAsync({ data: form });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "등록 요청에 실패했습니다.");
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <div>
              <h2 className="text-lg font-bold">등록 요청이 접수되었습니다</h2>
              <p className="text-sm text-muted-foreground mt-1">사업단 관리자 승인 후 로그인하실 수 있습니다.</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/login")}>
              로그인 페이지로 이동
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <BarChart className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">사용자 등록 요청</h1>
          <p className="text-sm text-muted-foreground">RISE 성과관리 시스템 이용 신청</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">기본 정보</CardTitle>
            <CardDescription>관리자 승인 후 로그인이 가능합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">이름 *</Label>
                  <Input id="name" value={form.name} onChange={set("name")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeNo">직번/사번 *</Label>
                  <Input id="employeeNo" placeholder="예: emp001" value={form.employeeNo} onChange={set("employeeNo")} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일 *</Label>
                <Input id="email" type="email" value={form.email} onChange={set("email")} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">소속/부서</Label>
                  <Input id="department" value={form.department} onChange={set("department")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">직위</Label>
                  <Input id="position" value={form.position} onChange={set("position")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호 *</Label>
                  <Input id="password" type="password" value={form.password} onChange={set("password")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordConfirm">비밀번호 확인 *</Label>
                  <Input id="passwordConfirm" type="password" value={form.passwordConfirm} onChange={set("passwordConfirm")} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="requestReason">요청 사유</Label>
                <Textarea id="requestReason" rows={3} value={form.requestReason} onChange={set("requestReason")} placeholder="시스템 사용 목적을 간략히 작성해 주세요." />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/login")}>
                  로그인으로 돌아가기
                </Button>
                <Button type="submit" className="flex-1" disabled={createRequest.isPending}>
                  {createRequest.isPending ? "제출 중..." : "등록 요청 제출"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
