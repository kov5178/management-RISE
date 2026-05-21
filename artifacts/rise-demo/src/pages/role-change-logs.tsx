import { useListRoleChangeLogs } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "최고관리자",
  admin: "사업단 관리자",
  project_manager: "프로젝트 관리자",
  task_manager: "단위과제 담당자",
  reviewer: "검토자",
  viewer: "조회자",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 border-transparent",
  admin: "bg-orange-100 text-orange-800 border-transparent",
  project_manager: "bg-blue-100 text-blue-800 border-transparent",
  task_manager: "bg-indigo-100 text-indigo-800 border-transparent",
  reviewer: "bg-yellow-100 text-yellow-800 border-transparent",
  viewer: "bg-gray-100 text-gray-700 border-transparent",
};

export default function RoleChangeLogs() {
  const { data: logs, isLoading } = useListRoleChangeLogs();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">권한 변경 이력</h2>
        <p className="text-muted-foreground">사용자 권한 변경 내역을 조회합니다.</p>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>변경 대상</TableHead>
              <TableHead>직번/사번</TableHead>
              <TableHead>이전 권한</TableHead>
              <TableHead>변경 권한</TableHead>
              <TableHead>변경자</TableHead>
              <TableHead>변경일시</TableHead>
              <TableHead>변경 사유</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !logs?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  권한 변경 이력이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              [...(logs ?? [])].reverse().map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.userName}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{log.userEmployeeNo}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[log.oldRole] ?? ""}>{ROLE_LABELS[log.oldRole] ?? log.oldRole}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[log.newRole] ?? ""}>{ROLE_LABELS[log.newRole] ?? log.newRole}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-medium">{log.changerName}</span>
                    <span className="text-muted-foreground ml-1">({ROLE_LABELS[log.changerRole] ?? log.changerRole})</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.changedAt).toLocaleString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.reason ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
