import { useState } from "react";
import { useListResults, useCreateReview, useListIndicators, getListResultsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, AlertCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reviews() {
  const currentYear = 2025;
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  const [activeTab, setActiveTab] = useState<string>("pending");

  const { data: indicators } = useListIndicators();
  const { data: allResults, isLoading } = useListResults({ year: Number(filterYear) });

  const createReview = useCreateReview();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  // Form states
  const [reviewStatus, setReviewStatus] = useState<string>("approved");
  const [comment, setComment] = useState("");

  // Filter results for tabs
  const pendingResults = allResults?.filter(r => r.status === "submitted" || r.status === "reviewing") || [];
  const completedResults = allResults?.filter(r => ["approved", "rejected", "revision_requested"].includes(r.status)) || [];

  const openReview = (result: any) => {
    setSelectedResult(result);
    setReviewStatus("approved");
    setComment("");
    setIsReviewOpen(true);
  };

  const handleReview = async () => {
    if (!selectedResult) return;
    try {
      await createReview.mutateAsync({
        data: {
          resultId: selectedResult.id,
          reviewerName: "검토자(Admin)",
          reviewStatus,
          comment
        }
      });
      // The backend should update the result status automatically
      queryClient.invalidateQueries({ queryKey: getListResultsQueryKey() });
      toast({ title: "검토 처리 성공", description: "검토 의견이 등록되었습니다." });
      setIsReviewOpen(false);
    } catch (e) {
      toast({ title: "처리 실패", description: "검토 처리에 실패했습니다.", variant: "destructive" });
    }
  };

  const years = [2025, 2026, 2027, 2028, 2029];

  const getIndicatorName = (indicatorId: number) => {
    return indicators?.find(i => i.id === indicatorId)?.name || "알 수 없는 지표";
  };

  const renderTable = (resultsList: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>지표명</TableHead>
          <TableHead>실적값</TableHead>
          <TableHead>제출일시</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="text-right">검토</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8"><Skeleton className="h-4 w-32 mx-auto" /></TableCell>
          </TableRow>
        ) : resultsList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">해당하는 실적이 없습니다.</TableCell>
          </TableRow>
        ) : (
          resultsList.map((res) => (
            <TableRow key={res.id}>
              <TableCell className="font-medium">{getIndicatorName(res.indicatorId)}</TableCell>
              <TableCell>{res.calculatedValue ?? '-'}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{res.submittedAt ? new Date(res.submittedAt).toLocaleString() : '-'}</TableCell>
              <TableCell><StatusBadge status={res.status} /></TableCell>
              <TableCell className="text-right">
                <Button variant={activeTab === "pending" ? "default" : "outline"} size="sm" onClick={() => openReview(res)}>
                  {activeTab === "pending" ? "검토하기" : <><Eye className="w-4 h-4 mr-2" /> 내역보기</>}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">검토 관리</h2>
          <p className="text-muted-foreground">제출된 실적을 검토하고 승인/반려 처리합니다.</p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            검토 대기 <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs">{pendingResults.length}</span>
          </TabsTrigger>
          <TabsTrigger value="completed">검토 완료</TabsTrigger>
        </TabsList>
        <div className="mt-4 border rounded-md bg-card">
          <TabsContent value="pending" className="m-0">
            {renderTable(pendingResults)}
          </TabsContent>
          <TabsContent value="completed" className="m-0">
            {renderTable(completedResults)}
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>실적 검토</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-3 bg-muted rounded-md border space-y-2 text-sm">
              <div className="font-medium">{getIndicatorName(selectedResult?.indicatorId)}</div>
              <div className="text-muted-foreground">실적값: {selectedResult?.calculatedValue ?? '-'}</div>
              {selectedResult?.selfEvaluation && (
                <div className="mt-2 pt-2 border-t">
                  <strong>자체평가:</strong> {selectedResult.selfEvaluation}
                </div>
              )}
            </div>

            {activeTab === "pending" ? (
              <>
                <div className="space-y-2">
                  <Label>검토 결과 판정</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={reviewStatus === "approved" ? "default" : "outline"}
                      className={`gap-2 ${reviewStatus === "approved" ? "bg-green-600 hover:bg-green-700" : ""}`}
                      onClick={() => setReviewStatus("approved")}
                    >
                      <CheckCircle className="w-4 h-4" /> 승인
                    </Button>
                    <Button
                      type="button"
                      variant={reviewStatus === "revision_requested" ? "default" : "outline"}
                      className={`gap-2 ${reviewStatus === "revision_requested" ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                      onClick={() => setReviewStatus("revision_requested")}
                    >
                      <AlertCircle className="w-4 h-4" /> 보완요청
                    </Button>
                    <Button
                      type="button"
                      variant={reviewStatus === "rejected" ? "default" : "outline"}
                      className={`gap-2 ${reviewStatus === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}`}
                      onClick={() => setReviewStatus("rejected")}
                    >
                      <XCircle className="w-4 h-4" /> 반려
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comment">검토 의견 (필수)</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={4}
                    placeholder="검토 의견, 보완이 필요한 사유 등을 입력하세요."
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                이미 검토가 완료된 항목입니다.<br />상태: <StatusBadge status={selectedResult?.status} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewOpen(false)}>닫기</Button>
            {activeTab === "pending" && (
              <Button onClick={handleReview} disabled={createReview.isPending || !comment.trim()}>
                검토 완료
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
