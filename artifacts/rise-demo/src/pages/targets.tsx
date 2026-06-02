import { Fragment, useState } from "react";
import { useListTargets, useCreateTarget, useUpdateTarget, useListIndicators, getListTargetsQueryKey } from "@workspace/api-client-react";
import type { Indicator } from "@workspace/api-client-react";
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
import { formatBusinessPeriod, getBusinessYearFromDate } from "@/lib/business-year";

function evaluateFormula(formula: string | null | undefined, childValues: number[]) {
  if (!childValues.length) return 0;
  if (!formula?.trim()) return childValues.reduce((total, value) => total + value, 0);
  const vars = Object.fromEntries(childValues.map((value, index) => [`child_${index + 1}`, value]));
  const expression = formula
    .replace(/\bsum\(children\)/gi, String(childValues.reduce((total, value) => total + value, 0)))
    .replace(/\bavg\(children\)/gi, String(childValues.reduce((total, value) => total + value, 0) / childValues.length));
  if (!/^[\d\s+\-*/()._a-zA-Z]+$/.test(expression)) return childValues.reduce((total, value) => total + value, 0);
  try {
    return Number(Function(...Object.keys(vars), `"use strict"; return (${expression});`)(...Object.values(vars))) || 0;
  } catch {
    return childValues.reduce((total, value) => total + value, 0);
  }
}

export default function Targets() {
  const currentBusinessYear = getBusinessYearFromDate(new Date());
  const [filterYear, setFilterYear] = useState<string>(currentBusinessYear.toString());
  const { data: indicators } = useListIndicators();
  const { data: targets, isLoading } = useListTargets({ year: Number(filterYear) });
  const createTarget = useCreateTarget();
  const updateTarget = useUpdateTarget();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);
  const [existingTarget, setExistingTarget] = useState<any>(null);
  const [targetValue, setTargetValue] = useState<number | "">("");
  const [note, setNote] = useState("");

  const indicatorRows = Array.isArray(indicators) ? indicators : [];
  const targetRows = Array.isArray(targets) ? targets : [];
  const parentIndicators = indicatorRows.filter((indicator) => indicator.indicatorType === "parent");
  const childIndicators = indicatorRows.filter((indicator) => indicator.indicatorType === "child");
  const years = Array.from({ length: 5 }, (_, index) => currentBusinessYear - 1 + index);

  const findTarget = (indicatorId: number) => targetRows.find((target) => target.indicatorId === indicatorId);
  const getChildTargetValue = (indicatorId: number) => findTarget(indicatorId)?.targetValue ?? 0;
  const getParentChildren = (parentId: number) => childIndicators.filter((child) => child.parentId === parentId);
  const getParentTargetValue = (parent: Indicator) => evaluateFormula(parent.formula, getParentChildren(parent.id).map((child) => getChildTargetValue(child.id)));

  const openEdit = (indicator: Indicator) => {
    const target = findTarget(indicator.id);
    setEditingIndicator(indicator);
    setExistingTarget(target);
    setTargetValue(target?.targetValue ?? "");
    setNote(target?.note ?? "");
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!editingIndicator || editingIndicator.indicatorType !== "child") return;
    try {
      if (existingTarget) {
        await updateTarget.mutateAsync({
          id: existingTarget.id,
          data: { targetValue: targetValue === "" ? null : Number(targetValue), note },
        });
      } else {
        await createTarget.mutateAsync({
          data: {
            indicatorId: editingIndicator.id,
            year: Number(filterYear),
            targetValue: targetValue === "" ? null : Number(targetValue),
            note,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: getListTargetsQueryKey() });
      toast({ title: "목표값 저장 완료", description: "하위지표 목표값이 저장되었습니다." });
      setIsEditOpen(false);
    } catch {
      toast({ title: "저장 실패", description: "목표값 저장에 실패했습니다.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">목표값 관리</h2>
          <p className="text-muted-foreground">하위지표 목표값을 입력하면 상위지표 목표값은 산출식 기준으로 자동 표시됩니다.</p>
          <p className="text-sm text-muted-foreground mt-1">사업기간: {formatBusinessPeriod(Number(filterYear))}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap">사업연도</Label>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[125px]"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((year) => <SelectItem key={year} value={year.toString()}>{year}년도</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">유형</TableHead>
              <TableHead>지표명</TableHead>
              <TableHead>단위</TableHead>
              <TableHead>사업연도</TableHead>
              <TableHead className="text-right">목표값</TableHead>
              <TableHead>비고</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              ))
            ) : parentIndicators.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">등록된 지표가 없습니다.</TableCell></TableRow>
            ) : parentIndicators.map((parent) => (
              <Fragment key={parent.id}>
                <TableRow className="bg-muted/60">
                  <TableCell><span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">상위지표</span></TableCell>
                  <TableCell className="font-semibold">{parent.name}</TableCell>
                  <TableCell>{parent.unit || "-"}</TableCell>
                  <TableCell>{filterYear}</TableCell>
                  <TableCell className="text-right font-semibold">{getParentTargetValue(parent).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">하위지표 목표값 기준 자동산출</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">산출식 수정은 지표관리에서 가능</TableCell>
                </TableRow>
                {getParentChildren(parent.id).map((child) => {
                  const target = findTarget(child.id);
                  return (
                    <TableRow key={child.id}>
                      <TableCell><span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">하위지표</span></TableCell>
                      <TableCell className="pl-8 font-medium">{child.name}</TableCell>
                      <TableCell>{child.unit || "-"}</TableCell>
                      <TableCell>{filterYear}</TableCell>
                      <TableCell className="text-right font-semibold">{target?.targetValue != null ? target.targetValue.toLocaleString() : <span className="text-sm font-normal text-muted-foreground">미설정</span>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{target?.note || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant={target ? "outline" : "default"} size="sm" onClick={() => openEdit(child)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          {target ? "수정" : "설정"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{filterYear}년도 하위지표 목표값 설정</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>지표명</Label>
              <div className="p-2 bg-muted rounded border text-sm font-medium">{editingIndicator?.name}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">목표값 ({editingIndicator?.unit || "단위 없음"})</Label>
              <Input id="target" type="number" value={targetValue} onChange={(event) => setTargetValue(event.target.value === "" ? "" : Number(event.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">비고</Label>
              <Input id="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="목표값 산출 근거 또는 메모" />
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
