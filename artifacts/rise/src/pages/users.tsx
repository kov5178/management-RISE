import { useState } from "react";
import { useListUsers, useUpdateUserRole, useUpdateUserStatus, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { UserDetail } from "@workspace/api-client-react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "최고관리자",
  admin: "사업단 관리자",
  project_manager: "프로젝트 관리자",
  task_manager: "단위과제 담당자",
  reviewer: "검토자",
  viewer: "조회자",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 border-transparent",
  admin: "bg-orange-100 text-orange-800 border-transparent",
  project_manager: "bg-blue-100 text-blue-800 border-transparent",
  task_manager: "bg-indigo-100 text-indigo-800 border-transparent",
  reviewer: "bg-yellow-100 text-yellow-800 border-transparent",
  viewer: "bg-gray-100 text-gray-700 border-transparent",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-transparent",
  inactive: "bg-gray-100 text-gray-600 border-transparent",
  pending: "bg-yellow-100 text-yellow-800 border-transparent",
  rejected: "bg-red-100 text-red-800 border-transparent",
  locked: "bg-orange-100 text-orange-800 border-transparent",
};

const STATUS_LABELS: Record<string, string> = {
  active: "활성",
  inactive: "비활성",
  pending: "대기중",
  rejected: "반려",
  locked: "잠김",
};

export default function Users() {
  const { data: users, isLoading } = useListUsers();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [roleTarget, setRoleTarget] = useState<UserDetail | null>(null);
  const [newRole, setNewRole] = useState("");
  const [roleReason, setRoleReason] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const handleRoleChange = async () => {
    if (!roleTarget || !newRole) return;
    try {
      await updateRole.mutateAsync({ id: roleTarget.id, data: { role: newRole, reason: roleReason || null } });
      toast({ title: "권한 변경 완료", description: `${roleTarget.name}님의 권한이 ${ROLE_LABELS[newRole]}으로 변경되었습니다.` });
      invalidate();
      setRoleTarget(null);
      setNewRole("");
      setRoleReason("");
    } catch {
      toast({ title: "오류", description: "권한 변경에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (user: UserDetail, status: string) => {
    try {
      await updateStatus.mutateAsync({ id: user.id, data: { status } });
      toast({ title: "상태 변경 완료" });
      invalidate();
    } catch {
      toast({ title: "오류", description: "상태 변경에 실패했습니다.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">사용자 목록</h2>
        <p className="text-muted-foreground">시스템 사용자와 권한을 관리합니다.</p>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>사용자</TableHead>
              <TableHead>직번/사번</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>소속</TableHead>
              <TableHead>권한</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>마지막 로그인</TableHead>
              {isAdmin && <TableHead className="text-right">관리</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : !users?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">등록된 사용자가 없습니다.</TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {user.name.substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{user.employeeNo}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                  <TableCell>{user.department ?? "-"}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[user.role] ?? ""}>{ROLE_LABELS[user.role] ?? user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[user.status] ?? ""}>{STATUS_LABELS[user.status] ?? user.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("ko-KR") : "-"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setRoleTarget(user); setNewRole(user.role); setRoleReason(""); }}
                        >
                          권한 변경
                        </Button>
                        {user.status === "active" ? (
                          <Button variant="ghost" size="sm" className="text-orange-600" onClick={() => handleStatusChange(user, "inactive")}>
                            비활성화
                          </Button>
                        ) : user.status === "inactive" ? (
                          <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleStatusChange(user, "active")}>
                            활성화
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!roleTarget} onOpenChange={() => setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>권한 변경 — {roleTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>변경할 권한</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>변경 사유</Label>
              <Textarea rows={3} value={roleReason} onChange={(e) => setRoleReason(e.target.value)} placeholder="권한 변경 사유를 입력하세요." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)}>취소</Button>
            <Button onClick={handleRoleChange} disabled={updateRole.isPending || !newRole}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
