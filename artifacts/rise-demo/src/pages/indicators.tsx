import { useState } from "react";
import { useListIndicators, useCreateIndicator, useUpdateIndicator, useDeleteIndicator, useListTasks, getListIndicatorsQueryKey } from "@workspace/api-client-react";
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

export default function Indicators() {
  const [filterTaskId, setFilterTaskId] = useState<string>("all");
  const { data: tasks } = useListTasks();
  const { data: indicators, isLoading } = useListIndicators(filterTaskId !== "all" ? { taskId: Number(filterTaskId) } : undefined);
  
  const createIndicator = useCreateIndicator();
  const updateIndicator = useUpdateIndicator();
  const deleteIndicator = useDeleteIndicator();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<any>(null);

  // Form states
  const [taskId, setTaskId] = useState<string>("");
  const [parentId, setParentId] = useState<string>("none");
  const [indicatorType, setIndicatorType] = useState("parent");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [formula, setFormula] = useState("");
  const [weight, setWeight] = useState<number | "">("");
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setTaskId(filterTaskId !== "all" ? filterTaskId : "");
    setParentId("none");
    setIndicatorType("parent");
    setName("");
    setUnit("");
    setFormula("");
    setWeight("");
    setDescription("");
  };

  const handleCreate = async () => {
    if (!taskId || !name) return;
    try {
      await createIndicator.mutateAsync({
        data: { 
          taskId: Number(taskId), 
          parentId: parentId !== "none" ? Number(parentId) : null,
          indicatorType,
          name, 
          unit,
          formula,
          weight: weight === "" ? null : Number(weight),
          description 
        }
      });
      queryClient.invalidateQueries({ queryKey: getListIndicatorsQueryKey() });
      toast({ title: "지표 생성 성공", description: "새 지표가 생성되었습니다." });
      setIsCreateOpen(false);
      resetForm();
    } catch (e) {
      toast({ title: "생성 실패", description: "지표 생성에 실패했습니다.", variant: "destructive" });
    }
  };

  const openEdit = (indicator: any) => {
    setEditingIndicator(indicator);
    setTaskId(indicator.taskId.toString());
    setParentId(indicator.parentId ? indicator.parentId.toString() : "none");
    setIndicatorType(indicator.indicatorType);
    setName(indicator.name);
    setUnit(indicator.unit || "");
    setFormula(indicator.formula || "");
    setWeight(indicator.weight || "");
    setDescription(indicator.description || "");
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingIndicator || !name) return;
    try {
      await updateIndicator.mutateAsync({
        id: editingIndicator.id,
        data: { 
          parentId: parentId !== "none" ? Number(parentId) : null,
          indicatorType,
          name, 
          unit,
          formula,
          weight: weight === "" ? null : Number(weight),
          description 
        }
      });
      queryClient.invalidateQueries({ queryKey: getListIndicatorsQueryKey() });
      toast({ title: "지표 수정 성공", description: "지표 정보가 수정되었습니다." });
      setIsEditOpen(false);
    } catch (e) {
      toast({ title: "수정 실패", description: "지표 수정에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 이 지표를 삭제하시겠습니까? 연관된 목표값, 실적, 증빙이 모두 삭제될 수 있습니다.")) return;
    try {
      await deleteIndicator.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListIndicatorsQueryKey() });
      toast({ title: "지표 삭제 성공", description: "지표가 삭제되었습니다." });
    } catch (e) {
      toast({ title: "삭제 실패", description: "지표 삭제에 실패했습니다.", variant: "destructive" });
    }
  };

  const parentIndicators = indicators?.filter(i => i.indicatorType === "parent") || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">지표 관리</h2>
          <p className="text-muted-foreground">단위과제별 상위/하위 지표를 관리합니다.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterTaskId} onValueChange={setFilterTaskId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="단위과제 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 과제</SelectItem>
                {tasks?.map(t => (
                  <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2">
                <Plus className="w-4 h-4" /> 지표 등록
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>새 지표 등록</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4 grid-cols-2">
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>단위과제</Label>
                  <Select value={taskId} onValueChange={setTaskId}>
                    <SelectTrigger>
                      <SelectValue placeholder="과제를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {tasks?.map(t => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>지표 유형</Label>
                  <Select value={indicatorType} onValueChange={setIndicatorType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">상위지표</SelectItem>
                      <SelectItem value="child">하위지표</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {indicatorType === "child" && (
                  <div className="space-y-2 col-span-2">
                    <Label>상위지표 선택</Label>
                    <Select value={parentId} onValueChange={setParentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="상위지표를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">없음</SelectItem>
                        {parentIndicators.map(i => (
                          <SelectItem key={i.id} value={i.id.toString()}>{i.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">지표명</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} />
                </div>
                
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label htmlFor="unit">단위 (예: 건, 명, %)</Label>
                  <Input id="unit" value={unit} onChange={e => setUnit(e.target.value)} />
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label htmlFor="weight">가중치 (%)</Label>
                  <Input id="weight" type="number" value={weight} onChange={e => setWeight(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="formula">산출식</Label>
                  <Input id="formula" value={formula} onChange={e => setFormula(e.target.value)} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="desc">설명</Label>
                  <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>취소</Button>
                <Button onClick={handleCreate} disabled={createIndicator.isPending || !name || !taskId}>등록</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">유형</TableHead>
              <TableHead>지표명</TableHead>
              <TableHead>단위과제</TableHead>
              <TableHead>단위</TableHead>
              <TableHead>가중치</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : indicators?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">등록된 지표가 없습니다.</TableCell>
              </TableRow>
            ) : (
              indicators?.map((indicator) => {
                const task = tasks?.find(t => t.id === indicator.taskId);
                const isChild = indicator.indicatorType === "child";
                return (
                  <TableRow key={indicator.id}>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${isChild ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-800'}`}>
                        {isChild ? '하위' : '상위'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className={isChild ? "ml-4 border-l-2 border-muted pl-2" : ""}>
                        {indicator.name}
                        {indicator.formula && <div className="text-xs text-muted-foreground mt-1">산출식: {indicator.formula}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{task?.name || '-'}</TableCell>
                    <TableCell>{indicator.unit || '-'}</TableCell>
                    <TableCell>{indicator.weight ? `${indicator.weight}%` : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(indicator)}>
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(indicator.id)}>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>지표 수정</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 grid-cols-2">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label>단위과제</Label>
              <Select value={taskId} onValueChange={setTaskId} disabled>
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tasks?.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label>지표 유형</Label>
              <Select value={indicatorType} onValueChange={setIndicatorType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">상위지표</SelectItem>
                  <SelectItem value="child">하위지표</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {indicatorType === "child" && (
              <div className="space-y-2 col-span-2">
                <Label>상위지표 선택</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="상위지표를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">없음</SelectItem>
                    {parentIndicators.map(i => (
                      <SelectItem key={i.id} value={i.id.toString()}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-name">지표명</Label>
              <Input id="edit-name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="edit-unit">단위 (예: 건, 명, %)</Label>
              <Input id="edit-unit" value={unit} onChange={e => setUnit(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label htmlFor="edit-weight">가중치 (%)</Label>
              <Input id="edit-weight" type="number" value={weight} onChange={e => setWeight(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-formula">산출식</Label>
              <Input id="edit-formula" value={formula} onChange={e => setFormula(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-desc">설명</Label>
              <Textarea id="edit-desc" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>취소</Button>
            <Button onClick={handleEdit} disabled={updateIndicator.isPending || !name}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
