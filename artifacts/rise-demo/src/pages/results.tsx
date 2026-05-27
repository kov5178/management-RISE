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
import { Download, Edit2, FileText, Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { exportToCsv } from "@/lib/export-excel";
import { Progress } from "@/components/ui/progress";

type PdfDraft = { id: number; file: File | null };
const createPdfDraft = (): PdfDraft => ({ id: Date.now() + Math.random(), file: null });
const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const previewIndicators = [
  { id: 1, parentId: null, indicatorType: "parent", name: "지역혁신 성과 확산" },
  { id: 2, parentId: 1, indicatorType: "child", name: "산학협력 프로그램 운영" },
];
const previewTargets = [{ indicatorId: 2, targetValue: 30 }];
const previewResults = [
  { id: 101, indicatorId: 2, year: 2026, programName: "기업 공동 프로젝트 지원", resultDate: "2026-05-20", actualValue: 14, note: "협약기업 3개사 참여", progressRate: 46.7, status: "draft" },
  { id: 102, indicatorId: 2, year: 2026, programName: "성과공유 워크숍 개최", resultDate: "2026-05-24", actualValue: 8, note: "", progressRate: 26.7, status: "submitted" },
];
const previewEvidence = [{ id: 201, resultId: 101, fileName: "기업_공동프로젝트_성과보고서.pdf" }];

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
  const [pdfRows, setPdfRows] = useState<PdfDraft[]>([createPdfDraft()]);
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
  const evidenceRows: any[] = Array.isArray(evidenceFiles) ? evidenceFiles : previewEvidence.filter((file) => file.resultId === editingResult?.id);
  const parentIndicators = indicatorRows.filter((item) => item.indicatorType === "parent");
  const detailIndicators = indicatorRows.filter((item) => item.indicatorType === "child");
  const selectableDetails = detailIndicators.filter((item) => item.parentId === Number(parentId));
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);
  const findTargetValue = (detailId: number) => targetRows.find((target) => target.indicatorId === detailId)?.targetValue;
  const findDetailResults = (detailId: number) => resultRows.filter((result) => result.indicatorId === detailId);
  const sumActualValue = (detailId: number) => findDetailResults(detailId).reduce((total, result) => total + Number(result.actualValue ?? 0), 0);
  const calculateProgress = (value: number, targetValue: number | null | undefined) => targetValue ? Math.round((value / targetValue) * 1000) / 10 : null;

  const resetForm = () => {
    setEditingResult(null); setParentId(""); setIndicatorId(""); setProgramName(""); setResultDate(`${filterYear}-01-01`); setActualValue(""); setNote(""); setPdfRows([createPdfDraft()]);
  };
  const openCreate = () => { resetForm(); setIsFormOpen(true); };
  const openEdit = (result: any) => {
    const detail = detailIndicators.find((item) => item.id === result.indicatorId);
    setEditingResult(result); setParentId(detail?.parentId?.toString() ?? ""); setIndicatorId(result.indicatorId.toString()); setProgramName(result.programName ?? ""); setResultDate(result.resultDate ?? `${result.year}-01-01`); setActualValue(result.actualValue ?? ""); setNote(result.note ?? ""); setPdfRows([createPdfDraft()]); setIsFormOpen(true);
  };
  const addPdfRow = () => setPdfRows((rows) => [...rows, createPdfDraft()]);
  const removePdfRow = (id: number) => setPdfRows((rows) => rows.length === 1 ? [createPdfDraft()] : rows.filter((row) => row.id !== id));
  const handleFileChange = (id: number, file: File | null) => {
    if (file && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "PDF 파일 확인", description: "PDF 파일만 선택할 수 있습니다.", variant: "destructive" });
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      toast({ title: "파일 크기 확인", description: "PDF 파일은 10MB 이하만 등록할 수 있습니다.", variant: "destructive" });
      return;
    }
    setPdfRows((rows) => rows.map((row) => row.id === id ? { ...row, file } : row));
  };
  const handleSave = async () => {
    if (!indicatorId || !programName.trim() || !resultDate || actualValue === "") {
      toast({ title: "필수값 확인", description: "하위지표, 세부프로그램명, 실적날짜, 실적값을 입력해주세요.", variant: "destructive" }); return;
    }
    const selectedFiles = pdfRows.map((row) => row.file).filter((file): file is File => file !== null);
    if (!editingResult && selectedFiles.length === 0) {
      toast({ title: "PDF 증빙 확인", description: "세부프로그램 실적 등록 시 PDF 증빙파일을 선택해주세요.", variant: "destructive" }); return;
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
      for (const file of selectedFiles) {
        await createEvidence.mutateAsync({ data: { resultId, fileName: file.name, fileUrl: await readFileAsDataUrl(file), fileSize: Math.max(1, Math.ceil(file.size / 1024)), mimeType: "application/pdf", uploadedBy: "현재 사용자" } });
      }
      queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() }); queryClient.invalidateQueries({ queryKey: getListEvidenceQueryKey() }); setFilterYear(year.toString()); setIsFormOpen(false); resetForm();
      toast({ title: editingResult ? "수정 완료" : "입력 완료", description: "세부프로그램 실적과 PDF 증빙자료가 저장되었습니다." });
    } catch { toast({ title: "저장 실패", description: "미리보기에서는 입력 흐름만 확인할 수 있습니다.", variant: "destructive" }); }
  };
  const handleExport = () => exportToCsv(`results_${filterYear}`, resultRows.map((result) => {
    const detail = detailIndicators.find((item) => item.id === result.indicatorId);
    const parent = parentIndicators.find((item) => item.id === detail?.parentId);
    return { "상위 지표": parent?.name ?? "", "하위 지표": detail?.name ?? "", "세부프로그램명": result.programName, "실적날짜": result.resultDate, "실적값": result.actualValue, "비고": result.note ?? "" };
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div><h2 className="text-2xl font-bold tracking-tight">실적 입력</h2><p className="text-muted-foreground">하위지표별 세부프로그램 실적과 PDF 증빙자료를 등록합니다.</p></div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExport} variant="outline" className="gap-2"><Download className="w-4 h-4" /> 엑셀 다운로드</Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild><Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> 세부프로그램 실적 등록</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingResult ? "세부프로그램 실적 조회/수정" : "세부프로그램 실적 등록"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>지표 선택</Label><Select value={parentId} onValueChange={(value) => { setParentId(value); setIndicatorId(""); }} disabled={Boolean(editingResult)}><SelectTrigger><SelectValue placeholder="지표를 선택하세요" /></SelectTrigger><SelectContent>{parentIndicators.map((parent) => <SelectItem key={parent.id} value={parent.id.toString()}>{parent.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>하위지표 선택</Label><Select value={indicatorId} onValueChange={setIndicatorId} disabled={!parentId || Boolean(editingResult)}><SelectTrigger><SelectValue placeholder="하위지표를 선택하세요" /></SelectTrigger><SelectContent>{selectableDetails.map((detail) => <SelectItem key={detail.id} value={detail.id.toString()}>{detail.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="space-y-2"><Label htmlFor="programName">세부프로그램명</Label><Input id="programName" value={programName} onChange={(event) => setProgramName(event.target.value)} placeholder="세부프로그램명을 입력하세요" /></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="resultDate">실적날짜 *</Label><Input id="resultDate" type="date" value={resultDate} onChange={(event) => setResultDate(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="actualValue">실적값 *</Label><Input id="actualValue" type="number" value={actualValue} onChange={(event) => setActualValue(event.target.value === "" ? "" : Number(event.target.value))} /></div></div>
                <div className="space-y-2"><Label htmlFor="note">비고</Label><Textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="추가 내용을 입력하세요" /></div>
                {editingResult && evidenceRows.length > 0 && <div className="space-y-2"><Label>등록된 PDF 증빙자료</Label>{evidenceRows.map((file) => <div key={file.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm"><FileText className="w-4 h-4 text-red-500" />{file.fileName}</div>)}</div>}
                <div className="space-y-3 rounded border border-dashed p-3">
                  <div className="flex items-center justify-between"><Label>PDF 증빙자료 {editingResult ? "추가" : "등록 *"}</Label><div className="flex gap-1"><Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={addPdfRow} aria-label="PDF 라인 추가"><Plus className="w-4 h-4" /></Button><Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => removePdfRow(pdfRows[pdfRows.length - 1].id)} aria-label="PDF 라인 삭제"><Minus className="w-4 h-4" /></Button></div></div>
                  {pdfRows.map((row, index) => <div key={row.id} className="flex items-center gap-2"><span className="w-12 text-xs text-muted-foreground">PDF {index + 1}</span><Input value={row.file?.name ?? ""} readOnly placeholder="선택된 파일 없음" className="flex-1" /><input id={`pdf-file-${row.id}`} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(event) => handleFileChange(row.id, event.target.files?.[0] ?? null)} /><label htmlFor={`pdf-file-${row.id}`} className="inline-flex h-10 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">파일 선택</label></div>)}
                  <p className="text-xs text-muted-foreground">선택된 PDF는 해당 세부프로그램 실적에 연결되며 증빙관리 메뉴에서 확인할 수 있습니다.</p>
                </div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setIsFormOpen(false)}>취소</Button><Button onClick={handleSave} disabled={createResult.isPending || updateResult.isPending || createEvidence.isPending}>{editingResult ? "수정" : "입력"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Select value={filterYear} onValueChange={setFilterYear}><SelectTrigger className="w-[115px]"><SelectValue /></SelectTrigger><SelectContent>{years.map((year) => <SelectItem key={year} value={year.toString()}>{year}년도</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      {usingPreviewData && <p className="text-sm text-muted-foreground">미리보기용 예시 데이터로 유형별 실적 합계와 PDF 파일 선택 구조를 표시합니다.</p>}
      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader><TableRow><TableHead className="w-[115px]">유형</TableHead><TableHead>지표명 / 세부프로그램명</TableHead><TableHead>실적날짜</TableHead><TableHead>목표값 / 실적값</TableHead><TableHead className="w-[160px]">진척도</TableHead><TableHead>비고</TableHead><TableHead>상태</TableHead><TableHead className="text-right">관리</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && Array.isArray(results) ? Array.from({ length: 4 }).map((_, index) => <TableRow key={index}><TableCell colSpan={8}><Skeleton className="h-5 w-full" /></TableCell></TableRow>) : parentIndicators.map((parent) => (
              <Fragment key={parent.id}>
                <TableRow className="bg-muted/60"><TableCell><span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">상위 지표</span></TableCell><TableCell colSpan={7} className="font-semibold">{parent.name}</TableCell></TableRow>
                {detailIndicators.filter((detail) => detail.parentId === parent.id).map((detail) => {
                  const detailResults = findDetailResults(detail.id); const detailActual = sumActualValue(detail.id); const targetValue = findTargetValue(detail.id); const detailProgress = calculateProgress(detailActual, targetValue);
                  return <Fragment key={detail.id}>
                    <TableRow className="bg-muted/20"><TableCell><span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">하위 지표</span></TableCell><TableCell className="pl-6 font-medium">{detail.name}</TableCell><TableCell>-</TableCell><TableCell><div className="font-semibold text-primary">{detailActual.toLocaleString()}</div><div className="text-xs text-muted-foreground">/ {targetValue?.toLocaleString() ?? "목표값 미설정"}</div></TableCell><TableCell><div className="text-xs mb-1">{detailProgress === null ? "-" : `${detailProgress.toFixed(1)}%`}</div><Progress value={Math.min(detailProgress ?? 0, 100)} className="h-2" /></TableCell><TableCell>세부프로그램 합계</TableCell><TableCell>-</TableCell><TableCell /></TableRow>
                    {detailResults.map((result) => <TableRow key={result.id}><TableCell><span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">세부프로그램</span></TableCell><TableCell className="pl-10">{result.programName}</TableCell><TableCell>{result.resultDate}</TableCell><TableCell>{result.actualValue.toLocaleString()}</TableCell><TableCell><span className="text-xs">{result.progressRate?.toFixed(1) ?? "-"}%</span></TableCell><TableCell className="max-w-[180px] truncate">{result.note || "-"}</TableCell><TableCell><StatusBadge status={result.status} /></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openEdit(result)}><Edit2 className="w-4 h-4 mr-2" /> 조회/수정</Button></TableCell></TableRow>)}
                  </Fragment>;
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
