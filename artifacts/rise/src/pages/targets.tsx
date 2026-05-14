import { useState } from "react";
import { useListTargets, useCreateTarget, useUpdateTarget, useListIndicators, getListTargetsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function Targets() {
  const currentYear = 2025;
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  
  const { data: indicators } = useListIndicators();
  const { data: targets, isLoading } = useListTargets({ year: Number(filterYear) });
  
  const createTarget = useCreateTarget();
  const updateTarget = useUpdateTarget();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<any>(null);
  const [existingTarget, setExistingTarget] = useState<any>(null);

  // Form states
  const [targetValue, setTargetValue] = useState<number | "">("");
  const [note, setNote] = useState("");

  const openEdit = (indicator: any, target: any) => {
    setEditingIndicator(indicator);
    setExistingTarget(target);
    setTargetValue(target ? target.targetValue : "");
    setNote(target ? (target.note || "") : "");
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!editingIndicator) return;
    try {
      if (existingTarget) {
        await updateTarget.mutateAsync({
          id: existingTarget.id,
          data: { 
            targetValue: targetValue === "" ? null : Number(targetValue),
            note
          }
        });
      } else {
        await createTarget.mutateAsync({
          data: {
            indicatorId: editingIndicator.id,
            year: Number(filterYear),
            targetValue: targetValue === "" ? null : Number(targetValue),
            note
          }
        });
      }
      queryClient.invalidateQueries({ queryKey: getListTargetsQueryKey() });
      toast({ title: "목표값 저장 성공", description: "목표값이 저장되었습니다." });
      setIsEditOpen(false);
    } catch (e) {
      toast({ title: "저장 실패", description: "목표값 저장에 실패했습니다.", variant: "destructive" });
    }
  };

  const years = [2025, 2026, 2027, 2028, 2029];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">목표값 관리</h2>
          <p className="text-muted-foreground">연차별 지표 목표값을 등록하고 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">대상 연도</Label>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}년도</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>지표명</TableHead>
              <TableHead>단위</TableHead>
              <TableHead>연도</TableHead>
              <TableHead className="text-right">목표값</TableHead>
              <TableHead>비고</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : indicators?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">등록된 지표가 없습니다.</TableCell>
              </TableRow>
            ) : (
              indicators?.map((indicator) => {
                const target = targets?.find(t => t.indicatorId === indicator.id);
                return (
                  <TableRow key={indicator.id}>
                    <TableCell className="font-medium">{indicator.name}</TableCell>
                    <TableCell>{indicator.unit || '-'}</TableCell>
                    <TableCell>{filterYear}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {target?.targetValue !== null && target?.targetValue !== undefined ? target.targetValue.toLocaleString() : <span className="text-muted-foreground text-sm font-normal">미설정</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{target?.note || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant={target ? "outline" : "default"} size="sm" onClick={() => openEdit(indicator, target)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        {target ? "수정" : "설정"}
                      </Button>
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
            <DialogTitle>{filterYear}년도 목표값 설정</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>지표명</Label>
              <div className="p-2 bg-muted rounded border text-sm font-medium">{editingIndicator?.name}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">목표값 ({editingIndicator?.unit || "단위 없음"})</Label>
              <Input id="target" type="number" value={targetValue} onChange={e => setTargetValue(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">비고</Label>
              <Input id="note" value={note} onChange={e => setNote(e.target.value)} placeholder="산출 근거 등 메모" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={createTarget.isPending || updateTarget.isPending}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
