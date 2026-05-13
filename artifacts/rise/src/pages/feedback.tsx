import { useState } from "react";
import { useListFeedback, useCreateFeedback, useUpdateFeedback, useListTasks, getListFeedbackQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export default function Feedback() {
  const currentYear = 2025;
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  const { canWriteFeedback } = useAuth();
  
  const { data: tasks } = useListTasks();
  const { data: feedbacks, isLoading } = useListFeedback({ year: Number(filterYear) });
  
  const createFeedback = useCreateFeedback();
  const updateFeedback = useUpdateFeedback();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [existingFeedback, setExistingFeedback] = useState<any>(null);
  const [viewOnly, setViewOnly] = useState(false);

  const [evaluationContent, setEvaluationContent] = useState("");
  const [improvementPlan, setImprovementPlan] = useState("");
  const [actionStatus, setActionStatus] = useState("planned");
  const [dueDate, setDueDate] = useState("");

  const openEdit = (task: any, feedback: any, forceViewOnly = false) => {
    setEditingTask(task);
    setExistingFeedback(feedback);
    setEvaluationContent(feedback ? (feedback.evaluationContent || "") : "");
    setImprovementPlan(feedback ? (feedback.improvementPlan || "") : "");
    setActionStatus(feedback ? (feedback.actionStatus || "planned") : "planned");
    setDueDate(feedback ? (feedback.dueDate || "") : "");
    setViewOnly(forceViewOnly || !canWriteFeedback);
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!editingTask) return;
    try {
      if (existingFeedback) {
        await updateFeedback.mutateAsync({
          id: existingFeedback.id,
          data: { evaluationContent, improvementPlan, actionStatus, dueDate: dueDate || null }
        });
      } else {
        await createFeedback.mutateAsync({
          data: {
            taskId: editingTask.id,
            year: Number(filterYear),
            evaluationContent,
            improvementPlan,
            actionStatus,
            dueDate: dueDate || null
          }
        });
      }
      queryClient.invalidateQueries({ queryKey: getListFeedbackQueryKey() });
      toast({ title: "저장 성공", description: "자체평가 및 환류계획이 저장되었습니다." });
      setIsEditOpen(false);
    } catch (e) {
      toast({ title: "저장 실패", description: "저장에 실패했습니다.", variant: "destructive" });
    }
  };

  const years = [2023, 2024, 2025, 2026];

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "planned": return <Badge variant="outline" className="bg-gray-100 text-gray-800">조치예정</Badge>;
      case "in_progress": return <Badge variant="secondary" className="bg-blue-100 text-blue-800">조치중</Badge>;
      case "completed": return <Badge variant="default" className="bg-green-100 text-green-800">조치완료</Badge>;
      default: return <Badge variant="outline">미작성</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">자체평가 및 환류</h2>
          <p className="text-muted-foreground">단위과제별 연간 자체평가 의견과 개선(환류) 계획을 관리합니다.</p>
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
              <TableHead className="w-[200px]">단위과제명</TableHead>
              <TableHead>자체평가 요약</TableHead>
              <TableHead>환류(개선) 계획</TableHead>
              <TableHead className="w-[120px]">조치상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8"><Skeleton className="h-4 w-32 mx-auto" /></TableCell>
              </TableRow>
            ) : tasks?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">등록된 단위과제가 없습니다.</TableCell>
              </TableRow>
            ) : (
              tasks?.map((task) => {
                const fb = feedbacks?.find(f => f.taskId === task.id);
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell className="text-sm">
                      {fb?.evaluationContent ? (
                        <span className="line-clamp-2">{fb.evaluationContent}</span>
                      ) : (
                        <span className="text-muted-foreground italic">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {fb?.improvementPlan ? (
                        <span className="line-clamp-2">{fb.improvementPlan}</span>
                      ) : (
                        <span className="text-muted-foreground italic">-</span>
                      )}
                    </TableCell>
                    <TableCell>{fb ? getStatusBadge(fb.actionStatus) : getStatusBadge('none')}</TableCell>
                    <TableCell className="text-right">
                      {canWriteFeedback ? (
                        <Button variant={fb ? "outline" : "default"} size="sm" onClick={() => openEdit(task, fb)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          {fb ? "수정" : "작성"}
                        </Button>
                      ) : fb ? (
                        <Button variant="outline" size="sm" onClick={() => openEdit(task, fb, true)}>
                          <Eye className="w-4 h-4 mr-2" />조회
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewOnly ? "자체평가 조회" : "자체평가 및 환류계획 작성"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-3 bg-muted rounded-md border text-sm font-medium">
              단위과제: {editingTask?.name} ({filterYear}년도)
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="eval">자체평가 종합의견</Label>
              <Textarea 
                id="eval" 
                value={evaluationContent} 
                onChange={e => setEvaluationContent(e.target.value)} 
                rows={4}
                placeholder="해당 연도의 과제 수행 결과, 우수사항 및 미흡사항 등 종합적인 자체평가 의견을 기재하세요."
                disabled={viewOnly}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="plan">환류(개선) 계획</Label>
              <Textarea 
                id="plan" 
                value={improvementPlan} 
                onChange={e => setImprovementPlan(e.target.value)} 
                rows={4}
                placeholder="미흡사항에 대한 구체적인 개선 계획, 다음 연도 사업 반영 계획 등을 기재하세요."
                disabled={viewOnly}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>조치 상태</Label>
                <Select value={actionStatus} onValueChange={setActionStatus} disabled={viewOnly}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">조치예정</SelectItem>
                    <SelectItem value="in_progress">조치중</SelectItem>
                    <SelectItem value="completed">조치완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due">조치 완료 예정일</Label>
                <Input id="due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={viewOnly} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>닫기</Button>
            {!viewOnly && (
              <Button onClick={handleSave} disabled={createFeedback.isPending || updateFeedback.isPending}>저장</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
