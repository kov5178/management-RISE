import { Fragment, useState } from "react";
import { useListEvidence, useCreateEvidence, useDeleteEvidence, useListResults, useListIndicators, getListEvidenceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Trash2, File, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";

export default function Evidence() {
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  const { data: indicators } = useListIndicators();
  const { data: results } = useListResults({ year: Number(filterYear) });
  const { data: evidenceList, isLoading } = useListEvidence(selectedResultId ? { resultId: selectedResultId } : undefined);
  const createEvidence = useCreateEvidence();
  const deleteEvidence = useDeleteEvidence();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const indicatorRows = Array.isArray(indicators) ? indicators : [];
  const resultRows = Array.isArray(results) ? results : [];
  const evidenceRows = Array.isArray(evidenceList) ? evidenceList : [];
  const parentIndicators = indicatorRows.filter((indicator) => indicator.indicatorType === "parent");
  const selectedResult = resultRows.find((result) => result.id === selectedResultId);
  const selectedProgram = indicatorRows.find(
    (indicator) => indicator.id === selectedResult?.indicatorId && indicator.indicatorType === "program",
  );
  const years = Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);

  const resetForm = () => {
    setFileName("");
    setFileUrl("");
  };

  const handleUpload = async () => {
    if (!selectedResultId || !fileName || !fileUrl) return;
    try {
      await createEvidence.mutateAsync({
        data: {
          resultId: selectedResultId,
          fileName,
          fileUrl,
          fileSize: Math.floor(Math.random() * 5000) + 100,
          mimeType: "application/pdf",
          uploadedBy: "현재 사용자",
        },
      });
      queryClient.invalidateQueries({ queryKey: getListEvidenceQueryKey() });
      toast({ title: "증빙 등록 성공", description: "PDF 증빙자료가 등록되었습니다." });
      setIsUploadOpen(false);
      resetForm();
    } catch {
      toast({ title: "등록 실패", description: "증빙자료 등록에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("증빙자료를 삭제하시겠습니까?")) return;
    try {
      await deleteEvidence.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListEvidenceQueryKey() });
      toast({ title: "삭제 성공", description: "증빙자료가 삭제되었습니다." });
    } catch {
      toast({ title: "삭제 실패", description: "증빙자료 삭제에 실패했습니다.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">증빙 관리</h2>
          <p className="text-muted-foreground">세부프로그램 실적별 PDF 증빙자료를 등록하고 관리합니다.</p>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-220px)] min-h-[500px]">
        <div className="border rounded-md bg-card col-span-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b font-medium bg-muted/50">실적 목록 ({filterYear})</div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {parentIndicators.length === 0 ? (
              <div className="text-center p-4 text-sm text-muted-foreground">등록된 실적이 없습니다.</div>
            ) : (
              parentIndicators.map((parent) => {
                const details = indicatorRows.filter(
                  (indicator) => indicator.indicatorType === "child" && indicator.parentId === parent.id,
                );
                return (
                  <Fragment key={parent.id}>
                    <div className="px-3 py-2 text-sm font-semibold bg-muted/60 rounded-md">{parent.name}</div>
                    {details.map((detail) => {
                      const programs = indicatorRows.filter(
                        (indicator) => indicator.indicatorType === "program" && indicator.parentId === detail.id,
                      );
                      return (
                        <div key={detail.id} className="space-y-1">
                          <div className="px-3 pt-1 pl-5 text-xs font-medium text-muted-foreground">
                            하위 지표: {detail.name}
                          </div>
                          {programs.map((program) => {
                            const result = resultRows.find((row) => row.indicatorId === program.id);
                            if (!result) {
                              return (
                                <div key={program.id} className="ml-5 px-3 py-2 rounded-md text-sm text-muted-foreground">
                                  {program.name} <span className="float-right text-xs">실적 미등록</span>
                                </div>
                              );
                            }
                            const isSelected = selectedResultId === result.id;
                            return (
                              <button
                                key={program.id}
                                onClick={() => setSelectedResultId(result.id)}
                                className={`ml-5 w-[calc(100%-1.25rem)] text-left p-3 rounded-md transition-colors text-sm border flex flex-col gap-2 ${
                                  isSelected ? "bg-primary/5 border-primary shadow-sm" : "bg-transparent border-transparent hover:bg-muted"
                                }`}
                              >
                                <div className="font-medium line-clamp-2">{program.name}</div>
                                <div className="flex justify-between items-center w-full">
                                  <span className="text-muted-foreground">실적값 {result.actualValue ?? "-"}</span>
                                  <StatusBadge status={result.status} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })
            )}
          </div>
        </div>

        <div className="border rounded-md bg-card col-span-1 md:col-span-2 flex flex-col overflow-hidden">
          <div className="p-3 border-b font-medium bg-muted/50 flex justify-between items-center">
            <span>증빙 자료 목록{selectedProgram ? ` - ${selectedProgram.name}` : ""}</span>
            {selectedResultId && (
              <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={resetForm} className="h-8 gap-2">
                    <Upload className="w-3.5 h-3.5" /> 파일 등록
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>증빙자료 등록</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {selectedProgram && (
                      <p className="text-sm text-muted-foreground">세부프로그램: {selectedProgram.name}</p>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="fname">PDF 파일명</Label>
                      <Input id="fname" value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="예: 성과보고서.pdf" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="furl">파일 URL</Label>
                      <Input id="furl" value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} placeholder="https://" />
                    </div>
                    <p className="text-xs text-muted-foreground">PDF 파일만 증빙자료로 등록할 수 있습니다.</p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsUploadOpen(false)}>취소</Button>
                    <Button onClick={handleUpload} disabled={createEvidence.isPending || !fileName || !fileUrl}>등록</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {!selectedResultId ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <File className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>왼쪽 목록에서 세부프로그램 실적을 선택하면 증빙자료를 볼 수 있습니다.</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>세부프로그램명</TableHead>
                    <TableHead>파일명</TableHead>
                    <TableHead>용량</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8"><Skeleton className="h-4 w-32 mx-auto" /></TableCell>
                    </TableRow>
                  ) : evidenceRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">등록된 증빙자료가 없습니다.</TableCell>
                    </TableRow>
                  ) : (
                    evidenceRows.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{selectedProgram?.name ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium">
                            <File className="w-4 h-4 text-blue-500" />
                            {file.fileName}
                          </div>
                          <button
                            type="button"
                            className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1 ml-6"
                            onClick={async () => {
                              const response = await fetch(`/api/evidence/${file.id}/download`);
                              if (response.status === 401) {
                                toast({ title: "로그인이 필요합니다.", variant: "destructive" });
                                return;
                              }
                              if (response.status === 403) {
                                toast({ title: "다운로드 권한이 없습니다.", variant: "destructive" });
                                return;
                              }
                              if (!response.ok) {
                                toast({ title: "파일을 찾을 수 없습니다.", variant: "destructive" });
                                return;
                              }
                              const data = await response.json();
                              window.open(data.fileUrl, "_blank", "noreferrer");
                            }}
                          >
                            <Link2 className="w-3 h-3" /> 파일 열기
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {(file.fileSize || 0) > 1024 ? `${((file.fileSize || 0) / 1024).toFixed(1)}MB` : `${file.fileSize}KB`}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{new Date(file.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(file.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
