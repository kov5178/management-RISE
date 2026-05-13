import { useState } from "react";
import { useListProjects, useCreateProject, useUpdateProject, useDeleteProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canManageProjects } = useAuth();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endYear, setEndYear] = useState(new Date().getFullYear() + 4);
  const [status, setStatus] = useState("active");

  const resetForm = () => {
    setName("");
    setDescription("");
    setStartYear(new Date().getFullYear());
    setEndYear(new Date().getFullYear() + 4);
    setStatus("active");
  };

  const handleCreate = async () => {
    try {
      await createProject.mutateAsync({
        data: { name, description, startYear, endYear, status }
      });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      toast({ title: "프로젝트 생성 성공", description: "새 프로젝트가 생성되었습니다." });
      setIsCreateOpen(false);
      resetForm();
    } catch (e) {
      toast({ title: "생성 실패", description: "프로젝트 생성에 실패했습니다.", variant: "destructive" });
    }
  };

  const openEdit = (project: any) => {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description || "");
    setStartYear(project.startYear);
    setEndYear(project.endYear);
    setStatus(project.status);
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingProject) return;
    try {
      await updateProject.mutateAsync({
        id: editingProject.id,
        data: { name, description, startYear, endYear, status }
      });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      toast({ title: "프로젝트 수정 성공", description: "프로젝트 정보가 수정되었습니다." });
      setIsEditOpen(false);
    } catch (e) {
      toast({ title: "수정 실패", description: "프로젝트 수정에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 이 프로젝트를 삭제하시겠습니까? 연관된 모든 데이터가 삭제될 수 있습니다.")) return;
    try {
      await deleteProject.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      toast({ title: "프로젝트 삭제 성공", description: "프로젝트가 삭제되었습니다." });
    } catch (e) {
      toast({ title: "삭제 실패", description: "프로젝트 삭제에 실패했습니다.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">프로젝트 관리</h2>
          <p className="text-muted-foreground">최상위 RISE 프로젝트를 관리합니다.</p>
        </div>
        {canManageProjects && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2">
                <Plus className="w-4 h-4" /> 프로젝트 등록
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 프로젝트 등록</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">프로젝트명</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">설명</Label>
                  <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">시작 연도</Label>
                    <Input id="start" type="number" value={startYear} onChange={e => setStartYear(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">종료 연도</Label>
                    <Input id="end" type="number" value={endYear} onChange={e => setEndYear(Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>상태</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">진행중 (Active)</SelectItem>
                      <SelectItem value="completed">완료 (Completed)</SelectItem>
                      <SelectItem value="planned">계획 (Planned)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>취소</Button>
                <Button onClick={handleCreate} disabled={createProject.isPending || !name}>등록</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">ID</TableHead>
              <TableHead>프로젝트명</TableHead>
              <TableHead>기간</TableHead>
              <TableHead>상태</TableHead>
              {canManageProjects && <TableHead className="text-right">관리</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  {canManageProjects && <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>}
                </TableRow>
              ))
            ) : projects?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManageProjects ? 5 : 4} className="text-center py-8 text-muted-foreground">등록된 프로젝트가 없습니다.</TableCell>
              </TableRow>
            ) : (
              projects?.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="text-center text-muted-foreground">{project.id}</TableCell>
                  <TableCell className="font-medium">
                    {project.name}
                    {project.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{project.description}</div>}
                  </TableCell>
                  <TableCell>{project.startYear} ~ {project.endYear}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      project.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      project.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {project.status === 'active' ? '진행중' : project.status === 'completed' ? '완료' : '계획'}
                    </span>
                  </TableCell>
                  {canManageProjects && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(project)}>
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {canManageProjects && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>프로젝트 수정</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">프로젝트명</Label>
                <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">설명</Label>
                <Textarea id="edit-desc" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start">시작 연도</Label>
                  <Input id="edit-start" type="number" value={startYear} onChange={e => setStartYear(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end">종료 연도</Label>
                  <Input id="edit-end" type="number" value={endYear} onChange={e => setEndYear(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>상태</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">진행중 (Active)</SelectItem>
                    <SelectItem value="completed">완료 (Completed)</SelectItem>
                    <SelectItem value="planned">계획 (Planned)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>취소</Button>
              <Button onClick={handleEdit} disabled={updateProject.isPending || !name}>저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
