import { Fragment, useState } from "react";
import { useListResults, useCreateResult, useUpdateResult, useListIndicators, useListTargets, useListEvidence, useCreateEvidence, getListResultsQueryKey, getListEvidenceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Edit2, FileText, Plus, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { exportToCsv } from "@/lib/export-excel";
import { Progress } from "@/components/ui/progress";

const previewIndicators = [
  { id: 1, parentId: null, indicatorType: "parent", name: "지역혁신 성과 확산" },
  { id: 2, parentId: 1, indicatorType: "child", name: "산학협력 프로그램 운영" },
];

const previewTargets = [{ indicatorId: 2, targetValue: 20 }];

const previewResults = [
  { id: 101, indicatorId: 2, year: 2026, programName: "기업 공동 프로젝트 지원", resultDate: "2026-05-20", actualValue: 14, note: "협약기업 3개사 참여", progressRate: 70, status: "draft" },
  { id: 102, indicatorId: 2, year: 2026, programName: "성과공유 워크숍 개최", resultDate: "2026-05-24", actualValue: 8, note: "", progressRate: 40, status: "submitted" },
];

const previewEvidence = [
  { id: 201, resultId: 101, fileName: "기업_공동프로젝트_성과보고서.pdf" },
];

export default function Results() {
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<any>(null);
  const [parentId, setParentId] = useState("");
  const [indicatorId, setIndicatorId] = useState("");
  const [programName, setProgramName] = useState("");
  const [resultDate, setResultDate] = useState(`${currentYear}-01-01`);
  const [actualValue, setActualValue] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const [pdfFileUrl, setPdfFileUrl] = useState("");

  const { data: indicators } = useListIndicators();
  const { data: targets } = useListTargets({ year: Number(filterYear) });
  const { data: results, isLoading } = useListResults({ year: Number(filterYear) });
  const { data: evidenceFiles } = useListEvidence({ resultId: editingResult?.id ?? -1 });
  const createResult = useCreateResult();
  const updateResult = useUpdateResult();
  const createEvidence = useCreateEvidence();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const usingPreviewData = !Array.isArray(indicators);
  const indicatorRows: any[] = Array.isArray(indicators) ? indicators : previewIndicators;
  const targetRows: any[] = Array.isArray(targets) ? targets : previewTargets;
  const resultRows: any[] = Array.isArray(results) ? results : previewResults;
  const evidenceRows: any[] = Array.isArray(evidenceFiles)
    ? evidenceFiles
    : previewEvidence.filter((file) => file.resultId === editingResult?.id);
  const parentIndicators = indicatorRows.filter((item) => item.indicatorType === "parent");
  const detailIndicators = indicatorRows.filter((item) => item.indicatorType === "child");
  const selectableDetails = detailIndicators.filter((item) => item.parentId === Number(parentId));
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);
  const findTargetValue = (detailId: number) => targetRows.find((target) => target.indicatorId === detailId)?.targetValue;

  const resetForm = () => {
    setEditingResult(null);
    setParentId("");
    setIndicatorId("");
    setProgramName("");
    setResultDate(`${filterYear}-01-01`);
    setActualValue("");
    setNote("");
    setPdfFileName("");
    setPdfFileUrl("");
  };

  const openCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEdit = (result: any) => {
    const detail = detailIndicators.find((item) => item.id === result.indicatorId);
    setEditingResult(result);
    setParentId(detail?.parentId?.toString() ?? "");
    setIndicatorId(result.indicatorId.toString());
    setProgramName(result.programName ?? "");
    setResultDate(result.resultDate ?? `${result.year}-01-01`);
    setActualValue(result.actualValue ?? "");
    setNote(result.note ?? "");
    setPdfFileName("");
    setPdfFileUrl("");
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!indicatorId || !programName.trim() || !resultDate || actualValue === "") {
      toast({ title: "필수값 확인", description: "하위지표, 세부프로그램명, 실적날짜, 실적값을 입력해주세요.", variant: "destructive" });
      return;
    }
    if (!editingResult && (!pdfFileName || !pdfFileUrl)) {
      toast({ title: "PDF 증빙 확인", description: "세부프로그램 실적 등록 시 PDF 증빙파일을 등록해주세요.", variant: "destructive" });
      return;
    }
    if ((pdfFileName || pdfFileUrl) && (!pdfFileName.toLowerCase().endsWith(".pdf") || !pdfFileUrl)) {
      toast({ title: "PDF 증빙 확인", description: "PDF 파일명과 파일 URL을 모두 입력해주세요.", variant: "destructive" });
      return;
    }
    const year = Number(resultDate.slice(0, 4));
    try {
      let resultId: number;
      if (editingResult) {
        const saved = await updateResult.mutateAsync({ id: editingResult.id, data: { year, programName: programName.trim(), resultDate, actualValue: Number(actualValue), note: note || null } });
        resultId = saved.id;
      } else {
        const saved = await createResult.mutateAsync({ data: { indicatorId: Number(indicatorId), year, programName: programName.trim(), resultDate, actualValue: Number(actualValue), note: note || null } });
        resultId = saved.id;
      }
      if (pdfFileName && pdfFileUrl) {
        await createEvidence.mutateAsync({ data: { resultId, fileName: pdfFileName, fileUrl: pdfFileUrl, mimeType: "application/pdf", uploadedBy: "현재 사용자" } });
      }
      queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListEvidenceQueryKey() });
      setFilterYear(year.toString());
      setIsFormOpen(false);
      toast({ title: editingResult ? "수정 완료" : "입력 완료", description: "세부프로그램 실적이 저장되었습니다." });
    } catch {
      toast({ title: "저장 실패", description: "미리보기에서는 입력 흐름만 확인할 수 있습니다.", variant: "destructive" });
    }
  };

  const handleExport = () => {
    const exportData = resultRows.map((result) => {
      const detail = detailIndicators.find((item) => item.id === result.indicatorId);
      const parent = parentIndicators.find((item) => item.id === detail?.parentId);
      return { "지표명": parent?.name ?? "", "하위지표": detail?.name ?? "", "세부프로그램명": result.programName, "실적날짜": result.resultDate, "실적값": result.actualValue ?? "", "비고": result.note ?? "", "진척도(%)": result.progressRate ?? "", "상태": result.status };
    });
    exportToCsv(`results_${filterYear}`, exportData);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">실적 입력</h2>
          <p className="text-muted-foreground">하위지표별 세부프로그램 실적을 등록하고 조회합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExport} variant="outline" className="gap-2"><Download className="w-4 h-4" /> 엑셀 다운로드</Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> 세부프로그램 실적 등록</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[620px]">
              <DialogHeader><DialogTitle>{editingResult ? "세부프로그램 실적 조회/수정" : "세부프로그램 실적 등록"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>지표 선택</Label>
                    <Select value={parentId} onValueChange={(value) => { setParentId(value); setIndicatorId(""); }} disabled={Boolean(editingResult)}>
                      <SelectTrigger><SelectValue placeholder="지표를 선택하세요" /></SelectTrigger>
                      <SelectContent>{parentIndicators.map((parent) => <SelectItem key={parent.id} value={parent.id.toString()}>{parent.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>하위지표 선택</Label>
                    <Select value={indicatorId} onValueChange={setIndicatorId} disabled={!parentId || Boolean(editingResult)}>
                      <SelectTrigger><SelectValue placeholder="하위지표를 선택하세요" /></SelectTrigger>
                      <SelectContent>{selectableDetails.map((detail) => <SelectItem key={detail.id} value={detail.id.toString()}>{detail.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="programName">세부프로그램명</Label>
                  <Input id="programName" value={programName} onChange={(event) => setProgramName(event.target.value)} placeholder="세부프로그램명을 입력하세요" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="resultDate">실적날짜 *</Label><Input id="resultDate" type="date" value={resultDate} onChange={(event) => setResultDate(event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="actualValue">실적값 *</Label><Input id="actualValue" type="number" value={actualValue} onChange={(event) => setActualValue(event.target.value === "" ? "" : Number(event.target.value))} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="note">비고</Label><Textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="추가 내용을 입력하세요" /></div>
                {editingResult && evidenceRows.length > 0 && (
                  <div className="space-y-2">
                    <Label>등록된 PDF 증빙자료</Label>
                    {evidenceRows.map((file) => (
                      <div key={file.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                        <FileText className="w-4 h-4 text-red-500" />
                        <span>{file.fileName}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-3 rounded border border-dashed p-3">
                  <Label className="flex items-center gap-2"><Upload className="w-4 h-4" /> PDF 증빙자료 {editingResult ? "추가" : "등록 *"}</Label>
                  <Input value={pdfFileName} onChange={(event) => setPdfFileName(event.target.value)} placeholder="예: 세부프로그램_성과증빙.pdf" />
                  <Input type="url" value={pdfFileUrl} onChange={(event) => setPdfFileUrl(event.target.value)} placeholder="PDF 파일 URL" />
                  <p className="text-xs text-muted-foreground">{editingResult ? "PDF를 추가하면 증빙관리 메뉴에서도 함께 확인할 수 있습니다." : "실적 입력 시 PDF 증빙자료 등록이 필요합니다."}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFormOpen(false)}>취소</Button>
                <Button onClick={handleSave} disabled={createResult.isPending || updateResult.isPending || createEvidence.isPending}>{editingResult ? "수정" : "입력"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[115px]"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((year) => <SelectItem key={year} value={year.toString()}>{year}년도</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {usingPreviewData && (
        <p className="text-sm text-muted-foreground">미리보기용 예시 데이터로 세부프로그램 실적 입력 및 조회 구조를 표시합니다.</p>
      )}
      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>하위지표</TableHead><TableHead>세부프로그램명</TableHead><TableHead>실적날짜</TableHead><TableHead>목표값 / 실적값</TableHead><TableHead className="w-[160px]">진척도</TableHead><TableHead>비고</TableHead><TableHead>상태</TableHead><TableHead className="text-right">관리</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && Array.isArray(results) ? (
              Array.from({ length: 4 }).map((_, index) => <TableRow key={index}><TableCell colSpan={8}><Skeleton className="h-5 w-full" /></TableCell></TableRow>)
            ) : parentIndicators.map((parent) => {
              const details = detailIndicators.filter((detail) => detail.parentId === parent.id);
              return (
                <Fragment key={parent.id}>
                  <TableRow className="bg-muted/60"><TableCell colSpan={8} className="font-semibold">{parent.name}</TableCell></TableRow>
                  {details.map((detail) => {
                    const detailResults = resultRows.filter((result) => result.indicatorId === detail.id);
                    return detailResults.length === 0 ? (
                      <TableRow key={detail.id}><TableCell className="pl-8 font-medium">{detail.name}</TableCell><TableCell colSpan={7} className="text-muted-foreground">등록된 세부프로그램 실적이 없습니다.</TableCell></TableRow>
                    ) : detailResults.map((result, index) => {
                      const targetValue = findTargetValue(detail.id);
                      const progress = result.progressRate ?? 0;
                      return (
                        <TableRow key={result.id}>
                          <TableCell className="pl-8 font-medium">{index === 0 ? detail.name : ""}</TableCell>
                          <TableCell>{result.programName}</TableCell>
                          <TableCell>{result.resultDate}</TableCell>
                          <TableCell><div className="font-medium text-primary">{result.actualValue?.toLocaleString() ?? "-"}</div><div className="text-xs text-muted-foreground">/ {targetValue?.toLocaleString() ?? "목표값 미설정"}</div></TableCell>
                          <TableCell><div className="text-xs mb-1">{progress.toFixed(1)}%</div><Progress value={Math.min(progress, 100)} className="h-2" /></TableCell>
                          <TableCell className="max-w-[180px] truncate">{result.note || "-"}</TableCell>
                          <TableCell><StatusBadge status={result.status} /></TableCell>
                          <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openEdit(result)}><Edit2 className="w-4 h-4 mr-2" /> 조회/수정</Button></TableCell>
                        </TableRow>
                      );
                    });
                  })}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
