import { Fragment, useMemo, useState } from "react";
import { useListResults, useCreateResult, useUpdateResult, useListIndicators, useListTargets, useListTasks, getListResultsQueryKey } from "@workspace/api-client-react";
import type { Indicator, IndicatorResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-excel";
import { Progress } from "@/components/ui/progress";
import { BUSINESS_MONTHS, type BusinessMonthKey, formatBusinessPeriod, getBusinessYearFromDate } from "@/lib/business-year";

type MonthlyDraft = Record<BusinessMonthKey, number | "">;
type MonthlyValues = Record<BusinessMonthKey, number | null>;
type FormulaChild = { indicator: Indicator; value: number | null };

const emptyMonthlyDraft = (): MonthlyDraft =>
  Object.fromEntries(BUSINESS_MONTHS.map((month) => [month.key, ""])) as MonthlyDraft;

const toMonthlyValues = (row?: Partial<Record<BusinessMonthKey, number | null>>): MonthlyValues =>
  Object.fromEntries(BUSINESS_MONTHS.map((month) => [month.key, row?.[month.key] ?? null])) as MonthlyValues;

const toPayloadValues = (draft: MonthlyDraft) =>
  Object.fromEntries(BUSINESS_MONTHS.map((month) => [month.key, draft[month.key] === "" ? null : Number(draft[month.key])])) as Record<BusinessMonthKey, number | null>;

function sumMonthlyValues(values: Partial<Record<BusinessMonthKey, number | null | undefined>>) {
  const hasValue = BUSINESS_MONTHS.some((month) => values[month.key] !== null && values[month.key] !== undefined);
  if (!hasValue) return null;
  return BUSINESS_MONTHS.reduce((total, month) => total + Number(values[month.key] ?? 0), 0);
}

function calculateProgress(value: number | null, targetValue: number | null | undefined) {
  return value != null && targetValue ? Math.round((value / targetValue) * 1000) / 10 : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAlias(value: string) {
  return value.trim().replace(/[^0-9a-zA-Z가-힣_]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeWeight(weight: number | null | undefined) {
  if (weight == null) return 0;
  return weight > 1 ? weight / 100 : weight;
}

function evaluateFormula(formula: string | null | undefined, children: FormulaChild[]) {
  if (!children.length) return null;
  if (children.some((child) => child.value == null)) return null;

  const numericChildren = children.map((child) => ({ indicator: child.indicator, value: Number(child.value) }));
  if (!formula?.trim()) {
    return numericChildren.reduce((total, child) => total + child.value * normalizeWeight(child.indicator.weight), 0);
  }

  const vars: Record<string, number> = {};
  numericChildren.forEach((child, index) => {
    const letterAlias = String.fromCharCode(65 + index);
    vars[`child_${index + 1}`] = child.value;
    vars[letterAlias] = child.value;
    const normalizedName = normalizeAlias(child.indicator.name);
    if (normalizedName) vars[normalizedName] = child.value;
  });

  let expression = formula.trim();
  [...numericChildren].sort((a, b) => b.indicator.name.length - a.indicator.name.length).forEach((child) => {
    expression = expression.replace(new RegExp(`\\[${escapeRegExp(child.indicator.name)}\\]`, "g"), String(child.value));
    expression = expression.replace(new RegExp(escapeRegExp(child.indicator.name), "g"), String(child.value));
  });

  expression = expression
    .replace(/\bsum\(children\)/gi, String(numericChildren.reduce((total, child) => total + child.value, 0)))
    .replace(/\bavg\(children\)/gi, String(numericChildren.reduce((total, child) => total + child.value, 0) / numericChildren.length))
    .replace(/\bavg\(([^)]+)\)/gi, (_, inner: string) => {
      const values = inner.split(",").map((key) => Number(vars[key.trim()] ?? 0));
      return String(values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1));
    });

  if (!/^[\d\s+\-*/()._a-zA-Z]+$/.test(expression)) return null;

  try {
    const value = Number(Function(...Object.keys(vars), `"use strict"; return (${expression});`)(...Object.values(vars)));
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function formatNumber(value: number | null | undefined) {
  return value == null ? "-" : value.toLocaleString();
}

export default function Results() {
  const currentBusinessYear = getBusinessYearFromDate(new Date());
  const [filterYear, setFilterYear] = useState<string>(currentBusinessYear.toString());
  const [filterTaskId, setFilterTaskId] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<IndicatorResult | null>(null);
  const [indicatorId, setIndicatorId] = useState("");
  const [monthlyValues, setMonthlyValues] = useState<MonthlyDraft>(emptyMonthlyDraft());
  const [selectedMonth, setSelectedMonth] = useState<BusinessMonthKey>("marValue");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("draft");

  const { data: tasks } = useListTasks();
  const { data: indicators } = useListIndicators();
  const { data: targets } = useListTargets({ year: Number(filterYear) });
  const { data: results, isLoading } = useListResults({ year: Number(filterYear) });
  const createResult = useCreateResult();
  const updateResult = useUpdateResult();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const taskRows = Array.isArray(tasks) ? tasks : [];
  const indicatorRows = Array.isArray(indicators) ? indicators : [];
  const targetRows = Array.isArray(targets) ? targets : [];
  const resultRows = Array.isArray(results) ? results : [];
  const parentIndicators = indicatorRows.filter((item) => item.indicatorType === "parent" && (filterTaskId === "all" || item.taskId === Number(filterTaskId)));
  const allChildIndicators = indicatorRows.filter((item) => item.indicatorType === "child");
  const childIndicators = allChildIndicators.filter((item) => filterTaskId === "all" || item.taskId === Number(filterTaskId));
  const years = Array.from({ length: 5 }, (_, index) => currentBusinessYear - 1 + index);

  const resultByIndicator = useMemo(
    () => new Map(resultRows.map((result) => [result.indicatorId, result])),
    [resultRows],
  );

  const findTargetValue = (indicatorIdValue: number) =>
    targetRows.find((target) => target.indicatorId === indicatorIdValue)?.targetValue ?? null;

  const getChildMonthlyValues = (childId: number) => toMonthlyValues(resultByIndicator.get(childId));
  const getParentChildren = (parentId: number) => allChildIndicators.filter((child) => child.parentId === parentId);

  const getParentMonthlyValues = (parent: Indicator): MonthlyValues => {
    const children = getParentChildren(parent.id);
    if (children.length === 0) return toMonthlyValues(resultByIndicator.get(parent.id));
    return Object.fromEntries(
      BUSINESS_MONTHS.map((month) => {
        const formulaChildren = children.map((child) => ({ indicator: child, value: getChildMonthlyValues(child.id)[month.key] }));
        return [month.key, evaluateFormula(parent.formula, formulaChildren)];
      }),
    ) as MonthlyValues;
  };

  const getParentTarget = (parent: Indicator) => {
    const children = getParentChildren(parent.id);
    if (children.length === 0) return findTargetValue(parent.id);
    const formulaChildren = children.map((child) => ({ indicator: child, value: findTargetValue(child.id) ?? null }));
    return evaluateFormula(parent.formula, formulaChildren);
  };

  const openEdit = (indicator: Indicator) => {
    const result = resultByIndicator.get(indicator.id) ?? null;
    setEditingResult(result);
    setIndicatorId(indicator.id.toString());
    setMonthlyValues(
      Object.fromEntries(BUSINESS_MONTHS.map((month) => [month.key, result?.[month.key] ?? ""])) as MonthlyDraft,
    );
    setSelectedMonth("marValue");
    setNote(result?.note ?? "");
    setStatus(result?.status ?? "draft");
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!indicatorId) {
      toast({ title: "지표 확인", description: "실적을 입력할 지표를 선택해주세요.", variant: "destructive" });
      return;
    }

    const data = {
      year: Number(filterYear),
      ...toPayloadValues(monthlyValues),
      note: note || null,
      status,
    };

    try {
      if (editingResult) {
        await updateResult.mutateAsync({ id: editingResult.id, data });
      } else {
        await createResult.mutateAsync({ data: { indicatorId: Number(indicatorId), ...data } });
      }
      queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() });
      setIsFormOpen(false);
      toast({ title: "저장 완료", description: "실적값이 저장되었습니다." });
    } catch {
      toast({ title: "저장 실패", description: "실적값 저장에 실패했습니다. 산출식과 가중치를 확인해주세요.", variant: "destructive" });
    }
  };

  const handleExport = () => {
    const exportIndicators = [...parentIndicators.filter((parent) => getParentChildren(parent.id).length === 0), ...childIndicators];
    const rows = exportIndicators.map((indicator) => {
      const parent = indicatorRows.find((item) => item.id === indicator.parentId);
      const task = taskRows.find((item) => item.id === indicator.taskId);
      const result = resultByIndicator.get(indicator.id);
      const monthly = toMonthlyValues(result);
      const total = sumMonthlyValues(monthly);
      const targetValue = findTargetValue(indicator.id);
      const progress = calculateProgress(total, targetValue);
      return {
        "사업연도": filterYear,
        "단위과제": task?.name ?? "",
        "유형": indicator.indicatorType === "parent" ? "직접입력 상위지표" : "하위지표",
        "상위지표": parent?.name ?? "",
        "지표": indicator.name,
        "목표값": targetValue ?? "",
        "실적합계": total ?? "",
        "진척도": progress == null ? "" : `${progress}%`,
        ...Object.fromEntries(BUSINESS_MONTHS.map((month) => [month.label, monthly[month.key] ?? ""])),
        "비고": result?.note ?? "",
        "상태": result?.status ?? "",
      };
    });
    exportToCsv(`monthly_results_${filterYear}`, rows);
  };

  const selectedIndicator = indicatorRows.find((item) => item.id === Number(indicatorId));
  const selectedTask = taskRows.find((task) => task.id === Number(filterTaskId));
  const selectedMonthMeta = BUSINESS_MONTHS.find((month) => month.key === selectedMonth);
  const draftTotal = sumMonthlyValues(toPayloadValues(monthlyValues));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">실적 입력</h2>
          <p className="text-muted-foreground">하위지표가 있으면 자동산출, 하위지표가 없는 상위지표는 직접입력으로 실적을 관리합니다.</p>
          <p className="text-sm text-muted-foreground mt-1">사업기간: {formatBusinessPeriod(Number(filterYear))}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterTaskId} onValueChange={setFilterTaskId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="단위과제 선택" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 단위과제</SelectItem>
              {taskRows.map((task) => <SelectItem key={task.id} value={task.id.toString()}>{task.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleExport} variant="outline" className="gap-2"><Download className="w-4 h-4" /> CSV 다운로드</Button>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[125px]"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((year) => <SelectItem key={year} value={year.toString()}>{year}년도</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">입력 단위: {selectedTask?.name ?? "전체 단위과제"}</CardTitle>
        </CardHeader>
      </Card>

      <div className="border rounded-md bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">유형</TableHead>
              <TableHead>지표명</TableHead>
              <TableHead className="w-[150px]">진척도</TableHead>
              <TableHead className="text-right">목표값</TableHead>
              <TableHead className="min-w-[760px]"><MonthlyHeader /></TableHead>
              <TableHead>입력방식</TableHead>
              <TableHead>비고</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <TableRow key={index}><TableCell colSpan={9}><Skeleton className="h-5 w-full" /></TableCell></TableRow>)
            ) : parentIndicators.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">선택 단위과제에 등록된 지표가 없습니다.</TableCell></TableRow>
            ) : parentIndicators.map((parent) => {
              const parentChildren = getParentChildren(parent.id);
              const isAuto = parentChildren.length > 0;
              const parentMonthly = getParentMonthlyValues(parent);
              const parentTotal = sumMonthlyValues(parentMonthly);
              const parentTarget = getParentTarget(parent);
              const parentProgress = calculateProgress(parentTotal, parentTarget);
              const parentResult = resultByIndicator.get(parent.id);
              return (
                <Fragment key={parent.id}>
                  <TableRow className="bg-muted/60">
                    <TableCell><span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">상위지표</span></TableCell>
                    <TableCell className="font-semibold">
                      <div>{parent.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{isAuto ? `산출식: ${parent.formula || "하위지표 가중합"}` : "하위지표 없음: 직접입력"}</div>
                    </TableCell>
                    <TableCell><Progress value={Math.min(parentProgress ?? 0, 100)} className="h-2" /><div className="mt-1 text-xs">{parentProgress == null ? "목표 미설정" : `${parentProgress.toFixed(1)}%`}</div></TableCell>
                    <TableCell className="text-right font-semibold">{formatNumber(parentTarget)}</TableCell>
                    <TableCell><MonthlySummary monthly={parentMonthly} total={parentTotal} /></TableCell>
                    <TableCell><Badge variant={isAuto ? "secondary" : "outline"}>{isAuto ? "자동산출" : "직접입력"}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{isAuto ? "하위지표 기준 자동산출" : parentResult?.note || "-"}</TableCell>
                    <TableCell>{parentResult ? <StatusBadge status={parentResult.status} /> : "-"}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {isAuto ? "직접입력 불가" : <Button variant="outline" size="sm" onClick={() => openEdit(parent)}><Edit2 className="w-4 h-4 mr-2" /> 입력/수정</Button>}
                    </TableCell>
                  </TableRow>
                  {parentChildren.map((child) => {
                    const result = resultByIndicator.get(child.id);
                    const monthly = toMonthlyValues(result);
                    const total = sumMonthlyValues(monthly);
                    const targetValue = findTargetValue(child.id);
                    const progress = calculateProgress(total, targetValue);
                    return (
                      <TableRow key={child.id}>
                        <TableCell><span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">하위지표</span></TableCell>
                        <TableCell className="pl-8 font-medium">{child.name}</TableCell>
                        <TableCell><Progress value={Math.min(progress ?? 0, 100)} className="h-2" /><div className="mt-1 text-xs">{progress == null ? "목표 미설정" : `${progress.toFixed(1)}%`}</div></TableCell>
                        <TableCell className="text-right">{formatNumber(targetValue)}</TableCell>
                        <TableCell><MonthlySummary monthly={monthly} total={total} /></TableCell>
                        <TableCell><Badge variant="outline">직접입력</Badge></TableCell>
                        <TableCell className="max-w-[180px] truncate">{result?.note || "-"}</TableCell>
                        <TableCell>{result ? <StatusBadge status={result.status} /> : "-"}</TableCell>
                        <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openEdit(child)}><Edit2 className="w-4 h-4 mr-2" /> 입력/수정</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader><DialogTitle>월별 실적 입력/수정</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>지표명</Label>
                <div className="rounded border bg-muted px-3 py-2 text-sm font-medium">{selectedIndicator?.name ?? "-"}</div>
              </div>
              <div className="space-y-2">
                <Label>사업기준연도</Label>
                <div className="rounded border bg-muted px-3 py-2 text-sm">{filterYear}년도 ({formatBusinessPeriod(Number(filterYear))})</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
              <div className="space-y-2">
                <Label>월 선택</Label>
                <Select value={selectedMonth} onValueChange={(value) => setSelectedMonth(value as BusinessMonthKey)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BUSINESS_MONTHS.map((month) => <SelectItem key={month.key} value={month.key}>{month.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="selected-month-value">{selectedMonthMeta?.label ?? "선택 월"} 실적값</Label>
                <Input id="selected-month-value" type="number" value={monthlyValues[selectedMonth]} onChange={(event) => setMonthlyValues((values) => ({ ...values, [selectedMonth]: event.target.value === "" ? "" : Number(event.target.value) }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>상태</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">임시저장</SelectItem>
                    <SelectItem value="submitted">제출</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>합계</Label>
                <div className="rounded border bg-muted px-3 py-2 text-sm font-semibold">{formatNumber(draftTotal)}</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">비고</Label>
              <Textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={createResult.isPending || updateResult.isPending}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthlyHeader() {
  return (
    <div className="space-y-1">
      <div className="font-semibold">실적값</div>
      <div className="grid grid-cols-[repeat(13,minmax(44px,1fr))] gap-1 text-xs text-muted-foreground">
        <div className="rounded bg-muted px-2 py-1 text-center font-medium text-foreground">합계</div>
        {BUSINESS_MONTHS.map((month) => <div key={month.key} className="rounded bg-muted px-2 py-1 text-center">{month.label}</div>)}
      </div>
    </div>
  );
}

function MonthlySummary({ monthly, total }: { monthly: MonthlyValues; total: number | null }) {
  return (
    <div className="grid grid-cols-[repeat(13,minmax(44px,1fr))] gap-1 text-xs">
      <div className="rounded bg-muted px-2 py-1 text-center font-semibold">{formatNumber(total)}</div>
      {BUSINESS_MONTHS.map((month) => <div key={month.key} className="rounded bg-muted px-2 py-1 text-center">{formatNumber(monthly[month.key])}</div>)}
    </div>
  );
}
