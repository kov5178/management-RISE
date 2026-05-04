import { useState } from "react";
import { useListUsers, useCreateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Users() {
  const { data: users, isLoading } = useListUsers();
  const createUser = useCreateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [department, setDepartment] = useState("");

  const resetForm = () => {
    setName("");
    setEmail("");
    setRole("viewer");
    setDepartment("");
  };

  const handleCreate = async () => {
    if (!name || !email) return;
    try {
      await createUser.mutateAsync({
        data: { name, email, role, department }
      });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "사용자 생성 성공", description: "새 사용자가 등록되었습니다." });
      setIsCreateOpen(false);
      resetForm();
    } catch (e) {
      toast({ title: "생성 실패", description: "사용자 등록에 실패했습니다.", variant: "destructive" });
    }
  };

  const getRoleBadge = (r: string) => {
    switch(r) {
      case 'admin': return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-transparent">최고관리자</Badge>;
      case 'manager': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-transparent">사업담당자</Badge>;
      case 'reviewer': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-transparent">검토자</Badge>;
      default: return <Badge variant="secondary">조회권한</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">사용자 관리</h2>
          <p className="text-muted-foreground">시스템에 접근할 수 있는 사용자와 권한을 관리합니다.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <UserPlus className="w-4 h-4" /> 사용자 등록
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 사용자 등록</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept">소속/부서</Label>
                <Input id="dept" value={department} onChange={e => setDepartment(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>역할(권한)</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">최고관리자 (전체 관리)</SelectItem>
                    <SelectItem value="manager">사업담당자 (실적 입력)</SelectItem>
                    <SelectItem value="reviewer">검토자 (실적 승인)</SelectItem>
                    <SelectItem value="viewer">조회권한 (단순 열람)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>취소</Button>
              <Button onClick={handleCreate} disabled={createUser.isPending || !name || !email}>등록</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>사용자</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>소속/부서</TableHead>
              <TableHead>권한</TableHead>
              <TableHead>등록일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : users?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">등록된 사용자가 없습니다.</TableCell>
              </TableRow>
            ) : (
              users?.map((user) => (
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
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>{user.department || '-'}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
