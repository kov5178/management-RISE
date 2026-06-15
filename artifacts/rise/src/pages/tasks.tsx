import { useState } from "react";
import { useListTasks, useCreateTask, useUpdateTask, useDeleteTask, useListProjects, getListTasksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function Tasks() {
  const [filterProjectId, setFilterProjectId] = useState<string>("all");
  const { data: projects } = useListProjects();
  const { data: tasks, isLoading } = useListTasks(filterProjectId !== "all" ? { projectId: Number(filterProjectId) } : undefined);
  
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  // Form states
  const [projectId, setProjectId] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerName, setManagerName] = useState("");
  const [status, setStatus] = useState("active");

  const resetForm = () => {
    setProjectId(filterProjectId !== "all" ? filterProjectId : "");
    setName("");
    setDescription("");
    setManagerName("");
    setStatus("active");
  };

  const handleCreate = async () => {
    if (!projectId || !name) return;
    try {
      await createTask.mutateAsync({
        data: { projectId: Number(projectId), name, description, managerName, status }
      });
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      toast({ title: "단위과제 생성 성공", description: "새 단위과제가 생성되었습니다." });
      setIsCreateOpen(false);
      resetForm();
    } catch (e) {
      toast({ title: "생성 실패", description: "단위과제 생성에 실패했습니다.", variant: "destructive" });
    }
  };

  const openEdit = (task: any) => {
    setEditingTask(task);
    setProjectId(task.projectId.toString());
    setName(task.name);
    setDescription(task.description || "");
    setManagerName(task.managerName || "");
    setStatus(task.status);
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingTask || !name || !projectId) return;
    try {
      await updateTask.mutateAsync({
        id: editingTask.id,
        data: { projectId: Number(projectId), name, description, managerName, status } as any
      });
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      toast({ title: "단위과제 수정 성공", description: "단위과제 정보가 수정되었습니다." });
      setIsEditOpen(false);
    } catch (e) {
      toast({ title: "수정 실패", description: "단위과제 수정에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 이 단위과제를 삭제하시겠습니까? 연관된 하위 지표도 영향을 받을 수 있습니다.")) return;
    try {
      await deleteTask.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      toast({ title: "단위과제 삭제 성공", description: "단위과제가 삭제되었습니다." });
    } catch (e) {
      toast({ title: "삭제 실패", description: "단위과제 삭제에 실패했습니다.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">단위과제 관리</h2>
          <p className="text-muted-foreground">프로젝트 하위의 단위과제를 관리합니다.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterProjectId} onValueChange={setFilterProjectId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="프로젝트 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 프로젝트</SelectItem>
                {projects?.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2">
                <Plus className="w-4 h-4" /> 과제 등록
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 단위과제 등록</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>소속 프로젝트</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="프로젝트를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">과제명</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">설명</Label>
                  <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manager">담당자</Label>
                    <Input id="manager" value={managerName} onChange={e => setManagerName(e.target.value)} />
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>취소</Button>
                <Button onClick={handleCreate} disabled={createTask.isPending || !name || !projectId}>등록</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">ID</TableHead>
              <TableHead>단위과제명</TableHead>
              <TableHead>소속 프로젝트</TableHead>
              <TableHead>담당자</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : tasks?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">등록된 단위과제가 없습니다.</TableCell>
              </TableRow>
            ) : (
              tasks?.map((task) => {
                const project = projects?.find(p => p.id === task.projectId);
                return (
                  <TableRow key={task.id}>
                    <TableCell className="text-center text-muted-foreground">{task.id}</TableCell>
                    <TableCell className="font-medium">
                      {task.name}
                      {task.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{project?.name || `프로젝트 #${task.projectId}`}</TableCell>
                    <TableCell>{task.managerName || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.status === 'active' ? 'bg-blue-100 text-blue-800' :
                        task.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.status === 'active' ? '진행중' : task.status === 'completed' ? '완료' : '계획'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(task)}>
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>단위과제 수정</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>소속 프로젝트</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">과제명</Label>
              <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">설명</Label>
              <Textarea id="edit-desc" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-manager">담당자</Label>
                <Input id="edit-manager" value={managerName} onChange={e => setManagerName(e.target.value)} />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>취소</Button>
            <Button onClick={handleEdit} disabled={updateTask.isPending || !name || !projectId}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
