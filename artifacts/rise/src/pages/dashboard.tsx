import { useGetDashboardSummary, useGetDashboardProjects, useGetDashboardTasks, useGetDashboardAlerts, useGetDashboardTrend } from "@workspace/api-client-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToCsv } from "@/lib/export-excel";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, RefreshCcw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatBusinessPeriod, getBusinessYearFromDate } from "@/lib/business-year";

const formatPercent = (value: unknown) => {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
  return `${Number.isFinite(numericValue) ? numericValue.toFixed(1) : "0.0"}%`;
};

export default function Dashboard() {
  const currentYear = getBusinessYearFromDate(new Date());

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({ year: currentYear });
  const { data: projects, isLoading: isLoadingProjects } = useGetDashboardProjects({ year: currentYear });
  const { data: tasks, isLoading: isLoadingTasks } = useGetDashboardTasks({ year: currentYear });
  const { data: alerts, isLoading: isLoadingAlerts } = useGetDashboardAlerts({ year: currentYear });
  const { data: trend, isLoading: isLoadingTrend } = useGetDashboardTrend({ year: currentYear });
  const projectRows = Array.isArray(projects) ? projects : [];
  const taskRows = Array.isArray(tasks) ? tasks : [];
  const trendRows = Array.isArray(trend) ? trend : [];

  const handleExport = () => {
    if (taskRows.length === 0) return;
    exportToCsv(`dashboard_tasks_${currentYear}`, taskRows.map((task) => ({
      "프로젝트명": task.projectName,
      "단위과제명": task.taskName,
      "진척도(%)": task.progress,
      "승인 지표수": task.approvedCount,
      "총 지표수": task.indicatorCount,
    })));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">대시보드</h2>
          <p className="text-muted-foreground">{currentYear}년도 RISE 성과 종합 현황</p>
          <p className="text-sm text-muted-foreground mt-1">사업기간: {formatBusinessPeriod(currentYear)}</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> CSV 다운로드
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="전체 진척도" loading={isLoadingSummary} value={formatPercent(summary?.overallProgress)} />
        <SummaryCard title="프로젝트 / 과제" loading={isLoadingSummary} value={`${summary?.totalProjects ?? 0} / ${summary?.totalTasks ?? 0}`} />
        <SummaryCard title="총 지표수" loading={isLoadingSummary} value={String(summary?.totalIndicators ?? 0)} />
        <SummaryCard title="승인 완료" loading={isLoadingSummary} value={String(summary?.approvedCount ?? 0)} className="text-green-600" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>프로젝트별 진척도</CardTitle></CardHeader>
          <CardContent>
            {isLoadingProjects ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectRows} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="projectName" type="category" width={150} tick={{ fontSize: 12 }} />
                    <RechartsTooltip formatter={(value) => [formatPercent(value), "진척도"]} />
                    <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>월별 목표 대비 실적 추이</CardTitle></CardHeader>
          <CardContent>
            {isLoadingTrend ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendRows} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={40} />
                    <RechartsTooltip formatter={(value, name) => [formatPercent(value), name]} />
                    <Legend />
                    <Line type="monotone" dataKey="targetProgress" name="목표 진척도" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="actualProgress" name="실적 진척도" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>단위과제별 진척도</CardTitle></CardHeader>
          <CardContent>
            {isLoadingTasks ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>단위과제명</TableHead>
                      <TableHead>프로젝트</TableHead>
                      <TableHead className="text-right">진척도</TableHead>
                      <TableHead className="text-right">승인/총 지표</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskRows.map((task) => (
                      <TableRow key={task.taskId}>
                        <TableCell className="font-medium">{task.taskName}</TableCell>
                        <TableCell className="text-muted-foreground">{task.projectName}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {formatPercent(task.progress)}
                            {task.isOverTarget && <Badge variant="secondary" className="bg-green-100 text-green-800">초과달성</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{task.approvedCount} / {task.indicatorCount}</TableCell>
                      </TableRow>
                    ))}
                    {taskRows.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <AlertCard
            title="위험지표 알림"
            icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
            loading={isLoadingAlerts}
            items={alerts?.atRiskIndicators ?? []}
            emptyText="위험지표가 없습니다."
          />
          <AlertCard
            title="보완요청 알림"
            icon={<RefreshCcw className="w-5 h-5 text-blue-500" />}
            loading={isLoadingAlerts}
            items={alerts?.revisionRequestedIndicators ?? []}
            emptyText="보완요청 건이 없습니다."
          />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, loading, value, className = "" }: { title: string; loading: boolean; value: string; className?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>{loading ? <Skeleton className="h-8 w-20" /> : <div className={`text-2xl font-bold ${className}`}>{value}</div>}</CardContent>
    </Card>
  );
}

function AlertCard({
  title,
  icon,
  loading,
  items,
  emptyText,
}: {
  title: string;
  icon: ReactNode;
  loading: boolean;
  items: Array<{ indicatorId: number; indicatorName: string; taskName: string; progress?: number | null }>;
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-20 w-full" /> : (
          <div className="space-y-3">
            {items.slice(0, 3).map((indicator) => (
              <div key={indicator.indicatorId} className="flex justify-between items-start border-b pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="font-medium text-sm">{indicator.indicatorName}</div>
                  <div className="text-xs text-muted-foreground">{indicator.taskName}</div>
                </div>
                {indicator.progress != null && <div className="text-xs font-bold text-red-500">{indicator.progress.toFixed(1)}%</div>}
              </div>
            ))}
            {items.length === 0 && <div className="text-sm text-muted-foreground text-center py-2">{emptyText}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
