import { useState } from "react";
import { useListResults, useCreateResult, useUpdateResult, useSubmitResult, useListIndicators, useListTargets, getListResultsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Send, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { exportToCsv } from "@/lib/export-excel";
import { Progress } from "@/components/ui/progress";

export default function Results() {
  const currentYear = 2025;
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  
  const { data: indicators } = useListIndicators();
  const { data: targets } = useListTargets({ year: Number(filterYear) });
  const { data: results, isLoading } = useListResults({ year: Number(filterYear) });
  
  const createResult = useCreateResult();
  const updateResult = useUpdateResult();
  const submitResult = useSubmitResult();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<any>(null);
  const [existingResult, setExistingResult] = useState<any>(null);

  // Form states
  const [actualValue, setActualValue] = useState<number | "">("");
  const [selfEvaluation, setSelfEvaluation] = useState("");

  const handleExport = () => {
    if (!indicators || !results) return;
    const exportData = indicators.map(ind => {
      const res = results.find(r => r.indicatorId === ind.id);
      const tgt = targets?.find(t => t.indicatorId === ind.id);
      return {
        '지표명': ind.name,
        '단위': ind.unit,
        '연도': filterYear,
        '목표값': tgt?.targetValue ?? '미설정',
        '실적값': res?.actualValue ?? '',
        '진척도(%)': res?.progressRate ?? 0,
        '상태': res?.status || '미입력'
      };
    });
    exportToCsv(`results_${filterYear}`, exportData);
  };

  const openEdit = (indicator: any, result: any) => {
    setEditingIndicator(indicator);
    setExistingResult(result);
    setActualValue(result && result.actualValue !== null ? result.actualValue : "");
    setSelfEvaluation(result ? (result.selfEvaluation || "") : "");
    setIsEditOpen(true);
  };

  const handleSave = async (submit: boolean = false) => {
    if (!editingIndicator) return;
    try {
      let resId;
      if (existingResult) {
        await updateResult.mutateAsync({
          id: existingResult.id,
          data: { 
            actualValue: actualValue === "" ? null : Number(actualValue),
            selfEvaluation
          }
        });
        resId = existingResult.id;
      } else {
        const res = await createResult.mutateAsync({
          data: {
            indicatorId: editingIndicator.id,
            year: Number(filterYear),
            actualValue: actualValue === "" ? null : Number(actualValue),
            selfEvaluation
          }
        });
        resId = res.id;
      }
      
      if (submit) {
        await submitResult.mutateAsync({ id: resId });
        toast({ title: "제출 성공", description: "실적이 제출되었습니다. 검토가 진행됩니다." });
      } else {
        toast({ title: "임시저장 성공", description: "실적이 임시저장되었습니다." });
      }
      
      queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() });
      setIsEditOpen(false);
    } catch (e) {
      toast({ title: "처리 실패", description: "요청 처리에 실패했습니다.", variant: "destructive" });
    }
  };

  const years = [2025, 2026, 2027, 2028, 2029];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">실적 입력</h2>
          <p className="text-muted-foreground">지표별 달성 실적을 입력하고 제출합니다.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> 엑셀 다운로드
          </Button>
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
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">지표명</TableHead>
              <TableHead>목표값 / 실적값</TableHead>
              <TableHead className="w-[200px]">진척도</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : indicators?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">등록된 지표가 없습니다.</TableCell>
              </TableRow>
            ) : (
              indicators?.map((indicator) => {
                const target = targets?.find(t => t.indicatorId === indicator.id);
                const result = results?.find(r => r.indicatorId === indicator.id);
                const targetValStr = target?.targetValue !== null && target?.targetValue !== undefined ? target.targetValue.toLocaleString() : "목표값 미설정";
                const actualValStr = result?.actualValue !== null && result?.actualValue !== undefined ? result.actualValue.toLocaleString() : "-";
                const isReadonly = result && ["submitted", "reviewing", "approved"].includes(result.status);
                
                let prog = result?.progressRate || 0;
                const isOver = prog > 100;
                if (prog > 100) prog = 100;

                return (
                  <TableRow key={indicator.id}>
                    <TableCell className="font-medium">
                      {indicator.name}
                      <div className="text-xs text-muted-foreground mt-1">단위: {indicator.unit || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-primary">{actualValStr}</div>
                      <div className="text-xs text-muted-foreground">/ {targetValStr}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span>{(result?.progressRate || 0).toFixed(1)}%</span>
                          {isOver && <span className="text-green-600 font-bold">초과달성</span>}
                        </div>
                        <Progress value={prog} className={`h-2 ${isOver ? 'bg-green-100 [&>div]:bg-green-500' : ''}`} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {result ? <StatusBadge status={result.status} /> : <span className="text-xs text-muted-foreground">미입력</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {isReadonly ? (
                        <Button variant="outline" size="sm" onClick={() => openEdit(indicator, result)}>
                          조회
                        </Button>
                      ) : (
                        <Button variant={result ? "secondary" : "default"} size="sm" onClick={() => openEdit(indicator, result)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          {result ? "수정" : "입력"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>실적 입력 ({filterYear}년도)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-3 bg-muted rounded-md border space-y-2">
              <div className="font-medium text-sm">{editingIndicator?.name}</div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>단위: {editingIndicator?.unit || '-'}</span>
                <span>목표값: {targets?.find(t => t.indicatorId === editingIndicator?.id)?.targetValue ?? '미설정'}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="actual">당해연도 실적값</Label>
              <Input 
                id="actual" 
                type="number" 
                value={actualValue} 
                onChange={e => setActualValue(e.target.value === "" ? "" : Number(e.target.value))} 
                disabled={existingResult && ["submitted", "reviewing", "approved"].includes(existingResult.status)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="eval">자체평가 의견 (선택)</Label>
              <Textarea 
                id="eval" 
                value={selfEvaluation} 
                onChange={e => setSelfEvaluation(e.target.value)} 
                rows={4}
                placeholder="실적 달성 과정의 특이사항이나 부연 설명을 입력하세요."
                disabled={existingResult && ["submitted", "reviewing", "approved"].includes(existingResult.status)}
              />
            </div>
            
            {existingResult && existingResult.status === "revision_requested" && (
              <div className="p-3 bg-orange-50 border border-orange-200 text-orange-800 rounded-md text-sm mt-2">
                <strong>보완요청 사항:</strong> 검토자의 의견에 따라 실적 또는 증빙을 보완 후 다시 제출해주세요.
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            {existingResult && ["submitted", "reviewing", "approved"].includes(existingResult.status) ? (
              <Button onClick={() => setIsEditOpen(false)}>닫기</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>취소</Button>
                <Button variant="secondary" onClick={() => handleSave(false)} disabled={createResult.isPending || updateResult.isPending}>
                  임시저장
                </Button>
                <Button onClick={() => handleSave(true)} disabled={createResult.isPending || updateResult.isPending || submitResult.isPending || actualValue === ""} className="gap-2">
                  <Send className="w-4 h-4" /> 제출하기
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
