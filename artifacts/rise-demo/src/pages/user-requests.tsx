import { useState } from "react";
import { useListRegistrationRequests, useApproveRegistrationRequest, useRejectRegistrationRequest, getListRegistrationRequestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RegistrationRequest } from "@workspace/api-client-react";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: "대기 중", className: "bg-yellow-100 text-yellow-800 border-transparent" },
  approved: { label: "승인", className: "bg-green-100 text-green-800 border-transparent" },
  rejected: { label: "반려", className: "bg-red-100 text-red-800 border-transparent" },
};

export default function UserRequests() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: requests, isLoading } = useListRegistrationRequests({ status: "pending" });
  const approve = useApproveRegistrationRequest();
  const reject = useRejectRegistrationRequest();

  const [selected, setSelected] = useState<RegistrationRequest | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | "view" | null>(null);
  const [comment, setComment] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListRegistrationRequestsQueryKey() });

  const handleApprove = async () => {
    if (!selected) return;
    try {
      await approve.mutateAsync({ id: selected.id, data: { reviewComment: comment || undefined } });
      toast({ title: "승인 완료", description: `${selected.name}님의 등록 요청이 승인되었습니다.` });
      invalidate();
      setAction(null);
      setSelected(null);
      setComment("");
    } catch {
      toast({ title: "오류", description: "승인 처리 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    try {
      await reject.mutateAsync({ id: selected.id, data: { reviewComment: comment || undefined } });
      toast({ title: "반려 완료", description: `${selected.name}님의 등록 요청이 반려되었습니다.` });
      invalidate();
      setAction(null);
      setSelected(null);
      setComment("");
    } catch {
      toast({ title: "오류", description: "반려 처리 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">등록 요청 승인</h2>
        <p className="text-muted-foreground">사용자 등록 요청을 검토하고 승인 또는 반려합니다.</p>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>직번/사번</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>소속</TableHead>
              <TableHead>요청일</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">처리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !requests?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  대기 중인 등록 요청이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.name}</TableCell>
                  <TableCell className="font-mono text-sm">{req.employeeNo}</TableCell>
                  <TableCell className="text-muted-foreground">{req.email}</TableCell>
                  <TableCell>{req.department ?? "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(req.createdAt).toLocaleDateString("ko-KR")}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_MAP[req.status]?.className ?? ""}>
                      {STATUS_MAP[req.status]?.label ?? req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelected(req); setAction("view"); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => { setSelected(req); setAction("approve"); setComment(""); }}>
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => { setSelected(req); setAction("reject"); setComment(""); }}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View dialog */}
      <Dialog open={action === "view" && !!selected} onOpenChange={() => setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>등록 요청 상세</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              {[
                ["이름", selected.name],
                ["직번/사번", selected.employeeNo],
                ["이메일", selected.email],
                ["소속", selected.department ?? "-"],
                ["직위", selected.position ?? "-"],
                ["요청 사유", selected.requestReason ?? "-"],
                ["요청일", new Date(selected.createdAt).toLocaleString("ko-KR")],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-3 gap-2">
                  <span className="font-medium text-muted-foreground">{label}</span>
                  <span className="col-span-2">{value}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>닫기</Button>
            <Button onClick={() => { setAction("approve"); setComment(""); }}>승인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={action === "approve" && !!selected} onOpenChange={() => setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>등록 요청 승인</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground"><strong>{selected?.name}</strong>님의 등록 요청을 승인하시겠습니까?</p>
          <div className="space-y-2">
            <Label>승인 메모 (선택)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="메모를 입력하세요 (선택사항)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>취소</Button>
            <Button onClick={handleApprove} disabled={approve.isPending}>승인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={action === "reject" && !!selected} onOpenChange={() => setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>등록 요청 반려</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground"><strong>{selected?.name}</strong>님의 등록 요청을 반려하시겠습니까?</p>
          <div className="space-y-2">
            <Label>반려 사유</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="반려 사유를 입력하세요" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>취소</Button>
            <Button variant="destructive" onClick={handleReject} disabled={reject.isPending}>반려</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
