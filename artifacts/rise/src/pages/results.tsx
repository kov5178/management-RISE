import { Fragment, useState } from "react";
import {
  useListResults,
  useCreateResult,
  useUpdateResult,
  useSubmitResult,
  useListIndicators,
  useListTargets,
  useListEvidence,
  useCreateEvidence,
  getListResultsQueryKey,
  getListEvidenceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Send, Download, FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { exportToCsv } from "@/lib/export-excel";
import { Progress } from "@/components/ui/progress";

export default function Results() {
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());

  const { data: indicators } = useListIndicators();
  const { data: targets } = useListTargets({ year: Number(filterYear) });
  const { data: results, isLoading } = useListResults({ year: Number(filterYear) });

  const createResult = useCreateResult();
  const updateResult = useUpdateResult();
  const submitResult = useSubmitResult();
  const createEvidence = useCreateEvidence();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [editingDetail, setEditingDetail] = useState<any>(null);
  const [editingParent, setEditingParent] = useState<any>(null);
  const [existingResult, setExistingResult] = useState<any>(null);
  const [actualValue, setActualValue] = useState<number | "">("");
  const [selfEvaluation, setSelfEvaluation] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfFileUrl, setPdfFileUrl] = useState("");

  const { data: evidenceFiles } = useListEvidence({ resultId: existingResult?.id ?? -1 });

  const indicatorRows = Array.isArray(indicators) ? indicators : [];
  const targetRows = Array.isArray(targets) ? targets : [];
  const resultRows = Array.isArray(results) ? results : [];
  const evidenceRows = Array.isArray(evidenceFiles) ? evidenceFiles : [];
  const parentIndicators = indicatorRows.filter((item) => item.indicatorType === "parent");

  const findTargetValue = (program: any) => {
    const ownTarget = targetRows.find((target) => target.indicatorId === program.id)?.targetValue;
    if (ownTarget !== null && ownTarget !== undefined) return ownTarget;
    return targetRows.find((target) => target.indicatorId === program.parentId)?.targetValue;
  };

  const handleExport = () => {
    const programs = indicatorRows.filter((item) => item.indicatorType === "program");
    const exportData = programs.map((program) => {
      const detail = indicatorRows.find((item) => item.id === program.parentId);
      const parent = indicatorRows.find((item) => item.id === detail?.parentId);
      const result = resultRows.find((item) => item.indicatorId === program.id);
      return {
        "지표명": parent?.name ?? "",
        "세부지표": detail?.name ?? "",
        "세부프로그램": program.name,
        "단위": program.unit,
        "연도": filterYear,
        "목표값": findTargetValue(program) ?? "미설정",
        "실적값": result?.actualValue ?? "",
        "진척도(%)": result?.progressRate ?? 0,
        "상태": result?.status ?? "미입력",
      };
    });
    exportToCsv(`results_${filterYear}`, exportData);
  };

  const openEdit = (program: any, result: any, detail: any, parent: any) => {
    setEditingProgram(program);
    setEditingDetail(detail);
    setEditingParent(parent);
    setExistingResult(result);
    setActualValue(result?.actualValue ?? "");
    setSelfEvaluation(result?.selfEvaluation ?? "");
    setPdfFileName("");
    setPdfFileUrl("");
    setIsEditOpen(true);
  };

  const handleSave = async (submit = false) => {
    if (!editingProgram) return;
    if ((pdfFileName || pdfFileUrl) && (!pdfFileName.toLowerCase().endsWith(".pdf") || !pdfFileUrl)) {
      toast({ title: "PDF 증빙 확인", description: "PDF 파일명과 URL을 모두 입력해주세요.", variant: "destructive" });
      return;
    }

    try {
      let resultId: number;
      if (existingResult) {
        const saved = await updateResult.mutateAsync({
          id: existingResult.id,
          data: {
            actualValue: actualValue === "" ? null : Number(actualValue),
            selfEvaluation,
          },
        });
        resultId = saved.id;
      } else {
        const saved = await createResult.mutateAsync({
          data: {
            indicatorId: editingProgram.id,
            year: Number(filterYear),
            actualValue: actualValue === "" ? null : Number(actualValue),
            selfEvaluation,
          },
        });
        resultId = saved.id;
      }

      if (pdfFileName && pdfFileUrl) {
        await createEvidence.mutateAsync({
          data: {
            resultId,
            fileName: pdfFileName,
            fileUrl: pdfFileUrl,
            mimeType: "application/pdf",
            uploadedBy: "현재 사용자",
          },
        });
      }

      if (submit) {
        await submitResult.mutateAsync({ id: resultId });
        toast({ title: "제출 성공", description: "프로그램 실적과 증빙이 제출되었습니다." });
      } else {
        toast({ title: "임시저장 성공", description: "프로그램 실적과 증빙이 저장되었습니다." });
      }

      queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListEvidenceQueryKey() });
      setIsEditOpen(false);
    } catch (e) {
      toast({ title: "처리 실패", description: "실적 또는 증빙 등록에 실패했습니다.", variant: "destructive" });
    }
  };

  const years = Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">실적 입력</h2>
          <p className="text-muted-foreground">세부프로그램별 실적값과 PDF 증빙자료를 등록합니다.</p>
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
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>{year}년도</SelectItem>
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
              <TableHead className="w-[350px]">지표명 / 세부지표 / 세부프로그램</TableHead>
              <TableHead>목표값 / 실적값</TableHead>
              <TableHead className="w-[200px]">진척도</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-52" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : parentIndicators.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">등록된 지표가 없습니다.</TableCell>
              </TableRow>
            ) : (
              parentIndicators.map((parent) => {
                const details = indicatorRows.filter((item) => item.indicatorType === "child" && item.parentId === parent.id);
                return (
                  <Fragment key={parent.id}>
                    <TableRow className="bg-muted/60">
                      <TableCell colSpan={5} className="font-semibold">{parent.name}</TableCell>
                    </TableRow>
                    {details.map((detail) => {
                      const programs = indicatorRows.filter((item) => item.indicatorType === "program" && item.parentId === detail.id);
                      return (
                        <Fragment key={detail.id}>
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={5} className="pl-8 font-medium text-muted-foreground">세부지표: {detail.name}</TableCell>
                          </TableRow>
                          {programs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="pl-12 text-sm text-muted-foreground">등록된 세부프로그램이 없습니다.</TableCell>
                            </TableRow>
                          ) : programs.map((program) => {
                            const result = resultRows.find((item) => item.indicatorId === program.id);
                            const targetValue = findTargetValue(program);
                            const readonly = Boolean(result && ["submitted", "reviewing", "approved"].includes(result.status));
                            const progressRate = result?.progressRate ?? 0;
                            const progressBar = Math.min(progressRate, 100);
                            return (
                              <TableRow key={program.id}>
                                <TableCell className="pl-12">
                                  <div className="font-medium">{program.name}</div>
                                  <div className="text-xs text-muted-foreground mt-1">단위: {program.unit || "-"}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-semibold text-primary">{result?.actualValue?.toLocaleString() ?? "-"}</div>
                                  <div className="text-xs text-muted-foreground">/ {targetValue?.toLocaleString() ?? "목표값 미설정"}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between text-xs">
                                      <span>{progressRate.toFixed(1)}%</span>
                                      {progressRate > 100 && <span className="text-green-600 font-bold">초과달성</span>}
                                    </div>
                                    <Progress value={progressBar} className={`h-2 ${progressRate > 100 ? "bg-green-100 [&>div]:bg-green-500" : ""}`} />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {result ? <StatusBadge status={result.status} /> : <span className="text-xs text-muted-foreground">미입력</span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant={readonly ? "outline" : result ? "secondary" : "default"} size="sm" onClick={() => openEdit(program, result, detail, parent)}>
                                    {!readonly && <Edit2 className="w-4 h-4 mr-2" />}
                                    {readonly ? "조회" : result ? "수정 / PDF" : "입력 / PDF"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>세부프로그램 실적 입력 ({filterYear}년도)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-3 bg-muted rounded-md border space-y-1">
              <div className="text-xs text-muted-foreground">{editingParent?.name} / {editingDetail?.name}</div>
              <div className="font-medium text-sm">{editingProgram?.name}</div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>단위: {editingProgram?.unit || "-"}</span>
                <span>목표값: {editingProgram ? findTargetValue(editingProgram) ?? "미설정" : "-"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="actual">당해연도 실적값</Label>
              <Input
                id="actual"
                type="number"
                value={actualValue}
                onChange={(event) => setActualValue(event.target.value === "" ? "" : Number(event.target.value))}
                disabled={Boolean(existingResult && ["submitted", "reviewing", "approved"].includes(existingResult.status))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eval">자체평가 의견 (선택)</Label>
              <Textarea
                id="eval"
                value={selfEvaluation}
                onChange={(event) => setSelfEvaluation(event.target.value)}
                rows={3}
                placeholder="실적 달성 과정의 특이사항이나 부연 설명을 입력하세요."
                disabled={Boolean(existingResult && ["submitted", "reviewing", "approved"].includes(existingResult.status))}
              />
            </div>

            {existingResult && evidenceRows.length > 0 && (
              <div className="space-y-2">
                <Label>등록된 PDF 증빙</Label>
                {evidenceRows.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                    <FileText className="w-4 h-4 text-red-500" />
                    <span>{file.fileName}</span>
                  </div>
                ))}
              </div>
            )}

            {!(existingResult && ["submitted", "reviewing", "approved"].includes(existingResult.status)) && (
              <div className="space-y-3 rounded border border-dashed p-3">
                <Label className="flex items-center gap-2"><Upload className="w-4 h-4" /> PDF 증빙 추가 (선택)</Label>
                <Input value={pdfFileName} onChange={(event) => setPdfFileName(event.target.value)} placeholder="예: 프로그램_성과증빙.pdf" />
                <Input type="url" value={pdfFileUrl} onChange={(event) => setPdfFileUrl(event.target.value)} placeholder="PDF 파일 URL" />
                <p className="text-xs text-muted-foreground">PDF 파일명과 저장된 파일 URL을 입력하면 실적 저장 시 증빙자료로 연결됩니다.</p>
              </div>
            )}

            {existingResult?.status === "revision_requested" && (
              <div className="p-3 bg-orange-50 border border-orange-200 text-orange-800 rounded-md text-sm">
                <strong>보완요청 사항:</strong> 실적 또는 PDF 증빙을 보완 후 다시 제출해주세요.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {existingResult && ["submitted", "reviewing", "approved"].includes(existingResult.status) ? (
              <Button onClick={() => setIsEditOpen(false)}>닫기</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>취소</Button>
                <Button variant="secondary" onClick={() => handleSave(false)} disabled={createResult.isPending || updateResult.isPending || createEvidence.isPending}>
                  임시저장
                </Button>
                <Button onClick={() => handleSave(true)} disabled={createResult.isPending || updateResult.isPending || submitResult.isPending || createEvidence.isPending || actualValue === ""} className="gap-2">
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
