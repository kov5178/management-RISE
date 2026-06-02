import { Fragment, useState } from "react";
import { useListIndicators, useCreateIndicator, useUpdateIndicator, useDeleteIndicator, useListTasks, getListIndicatorsQueryKey } from "@workspace/api-client-react";
import type { Indicator } from "@workspace/api-client-react";
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
  const taskRows = Array.isArray(tasks) ? tasks : [];
  const indicatorRows = Array.isArray(indicators) ? indicators : [];

  const createIndicator = useCreateIndicator();
  const updateIndicator = useUpdateIndicator();
  const deleteIndicator = useDeleteIndicator();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);

  const [taskId, setTaskId] = useState<string>("");
  const [parentId, setParentId] = useState<string>("none");
  const [indicatorType, setIndicatorType] = useState("parent");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [formula, setFormula] = useState("");
  const [weight, setWeight] = useState<number | "">("");
  const [description, setDescription] = useState("");

  const parentIndicators = indicatorRows.filter((indicator) => indicator.indicatorType === "parent");
  const childIndicators = indicatorRows.filter((indicator) => indicator.indicatorType === "child");
  const selectableParents = parentIndicators
    .filter((item) => !taskId || item.taskId === Number(taskId))
    .filter((item) => item.id !== editingIndicator?.id);

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

  const handleIndicatorTypeChange = (value: string) => {
    setIndicatorType(value);
    setParentId("none");
    if (value === "child") setFormula("");
  };

  const buildPayload = () => ({
    taskId: Number(taskId),
    parentId: indicatorType === "child" ? Number(parentId) : null,
    indicatorType,
    name,
    unit: unit || null,
    formula: indicatorType === "parent" ? formula || null : null,
    weight: weight === "" ? null : Number(weight),
    description: description || null,
  });

  const handleCreate = async () => {
    if (!taskId || !name || (indicatorType === "child" && parentId === "none")) return;
    try {
      await createIndicator.mutateAsync({ data: buildPayload() });
      queryClient.invalidateQueries({ queryKey: getListIndicatorsQueryKey() });
      toast({ title: "지표 생성 성공", description: "지표가 생성되었습니다." });
      setIsCreateOpen(false);
      resetForm();
    } catch {
      toast({ title: "생성 실패", description: "지표 생성에 실패했습니다.", variant: "destructive" });
    }
  };

  const openEdit = (indicator: Indicator) => {
    setEditingIndicator(indicator);
    setTaskId(indicator.taskId.toString());
    setParentId(indicator.parentId ? indicator.parentId.toString() : "none");
    setIndicatorType(indicator.indicatorType);
    setName(indicator.name);
    setUnit(indicator.unit || "");
    setFormula(indicator.formula || "");
    setWeight(indicator.weight ?? "");
    setDescription(indicator.description || "");
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editingIndicator || !name || (indicatorType === "child" && parentId === "none")) return;
    try {
      const payload = buildPayload();
      await updateIndicator.mutateAsync({
        id: editingIndicator.id,
        data: {
          parentId: payload.parentId,
          indicatorType: payload.indicatorType,
          name: payload.name,
          unit: payload.unit,
          formula: payload.formula,
          weight: payload.weight,
          description: payload.description,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListIndicatorsQueryKey() });
      toast({ title: "지표 수정 성공", description: "지표 정보가 수정되었습니다." });
      setIsEditOpen(false);
    } catch {
      toast({ title: "수정 실패", description: "지표 수정에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 이 지표를 삭제하시겠습니까? 연결된 목표값과 실적도 함께 삭제될 수 있습니다.")) return;
    try {
      await deleteIndicator.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListIndicatorsQueryKey() });
      toast({ title: "지표 삭제 성공", description: "지표가 삭제되었습니다." });
    } catch {
      toast({ title: "삭제 실패", description: "지표 삭제에 실패했습니다.", variant: "destructive" });
    }
  };

  const renderForm = () => (
    <div className="grid gap-4 py-4 grid-cols-2">
      <div className="space-y-2 col-span-2 sm:col-span-1">
        <Label>단위과제</Label>
        <Select value={taskId} onValueChange={setTaskId} disabled={Boolean(editingIndicator)}>
          <SelectTrigger><SelectValue placeholder="과제를 선택하세요" /></SelectTrigger>
          <SelectContent>{taskRows.map((task) => <SelectItem key={task.id} value={task.id.toString()}>{task.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2 col-span-2 sm:col-span-1">
        <Label>유형</Label>
        <Select value={indicatorType} onValueChange={handleIndicatorTypeChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
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
            <SelectTrigger><SelectValue placeholder="상위지표를 선택하세요" /></SelectTrigger>
            <SelectContent>{selectableParents.map((indicator) => <SelectItem key={indicator.id} value={indicator.id.toString()}>{indicator.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2 col-span-2">
        <Label htmlFor="name">지표명</Label>
        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-2 col-span-2 sm:col-span-1">
        <Label htmlFor="unit">단위</Label>
        <Input id="unit" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="건, 명, %" />
      </div>
      <div className="space-y-2 col-span-2 sm:col-span-1">
        <Label htmlFor="weight">가중치 (%)</Label>
        <Input id="weight" type="number" value={weight} onChange={(event) => setWeight(event.target.value === "" ? "" : Number(event.target.value))} />
      </div>
      {indicatorType === "parent" && (
        <div className="space-y-2 col-span-2">
          <Label htmlFor="formula">상위지표 산출식</Label>
          <Input id="formula" value={formula} onChange={(event) => setFormula(event.target.value)} placeholder="child_1 + child_2, avg(child_1, child_2), sum(children)" />
          <p className="text-xs text-muted-foreground">비워두면 소속 하위지표 값의 합계로 산출합니다.</p>
        </div>
      )}
      <div className="space-y-2 col-span-2">
        <Label htmlFor="desc">설명</Label>
        <Textarea id="desc" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">지표관리</h2>
          <p className="text-muted-foreground">상위지표와 하위지표의 계층, 단위, 산출식을 관리합니다.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterTaskId} onValueChange={setFilterTaskId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="단위과제 필터" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 과제</SelectItem>
                {taskRows.map((task) => <SelectItem key={task.id} value={task.id.toString()}>{task.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2"><Plus className="w-4 h-4" /> 지표 등록</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>새 지표 등록</DialogTitle></DialogHeader>
              {renderForm()}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>취소</Button>
                <Button onClick={handleCreate} disabled={createIndicator.isPending || !name || !taskId || (indicatorType === "child" && parentId === "none")}>등록</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">유형</TableHead>
              <TableHead>지표명</TableHead>
              <TableHead>단위과제</TableHead>
              <TableHead>단위</TableHead>
              <TableHead>산출식</TableHead>
              <TableHead>가중치</TableHead>
              <TableHead>설명</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}><TableCell colSpan={8}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              ))
            ) : parentIndicators.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">등록된 지표가 없습니다.</TableCell></TableRow>
            ) : parentIndicators.map((parent) => {
              const task = taskRows.find((item) => item.id === parent.taskId);
              return (
                <Fragment key={parent.id}>
                  <IndicatorRow indicator={parent} taskName={task?.name} onEdit={openEdit} onDelete={handleDelete} />
                  {childIndicators.filter((child) => child.parentId === parent.id).map((child) => (
                    <IndicatorRow key={child.id} indicator={child} taskName={task?.name} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>지표 수정</DialogTitle></DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>취소</Button>
            <Button onClick={handleEdit} disabled={updateIndicator.isPending || !name || (indicatorType === "child" && parentId === "none")}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IndicatorRow({
  indicator,
  taskName,
  onEdit,
  onDelete,
}: {
  indicator: Indicator;
  taskName?: string;
  onEdit: (indicator: Indicator) => void;
  onDelete: (id: number) => void;
}) {
  const isChild = indicator.indicatorType === "child";
  return (
    <TableRow className={isChild ? "" : "bg-muted/60"}>
      <TableCell>
        <span className={`px-2 py-1 rounded text-xs font-medium ${isChild ? "bg-gray-100 text-gray-700" : "bg-blue-100 text-blue-800"}`}>
          {isChild ? "하위지표" : "상위지표"}
        </span>
      </TableCell>
      <TableCell className="font-medium">
        <div className={isChild ? "ml-4 border-l-2 border-muted pl-3" : ""}>{indicator.name}</div>
      </TableCell>
      <TableCell className="text-muted-foreground">{taskName || "-"}</TableCell>
      <TableCell>{indicator.unit || "-"}</TableCell>
      <TableCell className="max-w-[220px] truncate">{indicator.indicatorType === "parent" ? indicator.formula || "하위지표 합계" : "-"}</TableCell>
      <TableCell>{indicator.weight ? `${indicator.weight}%` : "-"}</TableCell>
      <TableCell className="max-w-[220px] truncate">{indicator.description || "-"}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(indicator)}>
            <Edit2 className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(indicator.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
