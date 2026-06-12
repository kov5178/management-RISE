import { useMemo, useState } from "react";
import { useGetDashboardProjects, useGetDashboardTasks, useGetDashboardAlerts, useGetDashboardTrend } from "@workspace/api-client-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToCsv } from "@/lib/export-excel";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBusinessPeriod, getBusinessYearFromDate } from "@/lib/business-year";

const formatPercent = (value: number | null | undefined) => `${(value ?? 0).toFixed(1)}%`;
const average = (values: number[]) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export default function Dashboard() {
  const currentYear = getBusinessYearFromDate(new Date());
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [selectedTaskId, setSelectedTaskId] = useState("all");

  const { data: projects, isLoading: isLoadingProjects } = useGetDashboardProjects({ year: currentYear });
  const { data: tasks, isLoading: isLoadingTasks } = useGetDashboardTasks({ year: currentYear });
  const { data: alerts, isLoading: isLoadingAlerts } = useGetDashboardAlerts({ year: currentYear });
  const { data: trend, isLoading: isLoadingTrend } = useGetDashboardTrend({
    year: currentYear,
    projectId: selectedProjectId === "all" ? undefined : Number(selectedProjectId),
  });

  const projectRows = Array.isArray(projects) ? projects : [];
  const taskRows = Array.isArray(tasks) ? tasks : [];
  const trendRows = Array.isArray(trend) ? trend : [];

  const availableTasks = useMemo(
    () => selectedProjectId === "all" ? taskRows : taskRows.filter((task) => task.projectId === Number(selectedProjectId)),
    [selectedProjectId, taskRows],
  );

  const filteredTasks = useMemo(() => {
    if (selectedTaskId !== "all") return taskRows.filter((task) => task.taskId === Number(selectedTaskId));
    if (selectedProjectId !== "all") return taskRows.filter((task) => task.projectId === Number(selectedProjectId));
    return taskRows;
  }, [selectedProjectId, selectedTaskId, taskRows]);

  const filteredProjects = useMemo(() => {
    if (selectedTaskId !== "all") {
      const task = taskRows.find((item) => item.taskId === Number(selectedTaskId));
      return task ? projectRows.filter((project) => project.projectId === task.projectId) : [];
    }
    if (selectedProjectId !== "all") return projectRows.filter((project) => project.projectId === Number(selectedProjectId));
    return projectRows;
  }, [projectRows, selectedProjectId, selectedTaskId, taskRows]);

  const filteredAlerts = useMemo(() => {
    const selectedProject = filteredProjects[0];
    const selectedTask = selectedTaskId !== "all" ? filteredTasks[0] : null;
    const items = alerts?.atRiskIndicators ?? [];
    return items.filter((item) => {
      if (selectedTask) return item.taskName === selectedTask.taskName;
      if (selectedProject) return item.projectName === selectedProject.projectName;
      return true;
    });
  }, [alerts?.atRiskIndicators, filteredProjects, filteredTasks, selectedTaskId]);

  const summary = useMemo(() => {
    const projectCount = selectedTaskId !== "all" ? (filteredTasks.length > 0 ? 1 : 0) : filteredProjects.length;
    const progressValues = filteredTasks.map((task) => task.progress ?? 0);
    return {
      overallProgress: Math.round(average(progressValues) * 10) / 10,
      totalProjects: projectCount,
      totalTasks: filteredTasks.length,
      totalIndicators: filteredTasks.reduce((sum, task) => sum + (task.indicatorCount ?? 0), 0),
      approvedCount: filteredTasks.reduce((sum, task) => sum + (task.approvedCount ?? 0), 0),
    };
  }, [filteredProjects.length, filteredTasks, selectedTaskId]);

  const selectedScopeLabel = selectedTaskId !== "all"
    ? filteredTasks[0]?.taskName ?? "선택 단위과제"
    : selectedProjectId !== "all"
      ? filteredProjects[0]?.projectName ?? "선택 프로젝트"
      : "전체 프로젝트";

  const handleProjectChange = (value: string) => {
    setSelectedProjectId(value);
    setSelectedTaskId("all");
  };

  const handleExport = () => {
    if (filteredTasks.length === 0) return;
    exportToCsv(`dashboard_tasks_${currentYear}`, filteredTasks.map((task) => ({
      "프로젝트명": task.projectName,
      "단위과제명": task.taskName,
      "진척도(%)": task.progress,
      "승인 지표수": task.approvedCount,
      "총 지표수": task.indicatorCount,
    })));
  };

  const isLoadingSummary = isLoadingProjects || isLoadingTasks;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">대시보드</h2>
          <p className="text-muted-foreground">프로젝트 관리와 단위과제 관리에 입력된 데이터 기준으로 현황을 확인합니다.</p>
          <p className="text-sm text-muted-foreground mt-1">사업기간: {formatBusinessPeriod(currentYear)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedProjectId} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="프로젝트 선택" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 프로젝트</SelectItem>
              {projectRows.map((project) => <SelectItem key={project.projectId} value={project.projectId.toString()}>{project.projectName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="단위과제 선택" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 단위과제</SelectItem>
              {availableTasks.map((task) => <SelectItem key={task.taskId} value={task.taskId.toString()}>{task.taskName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> CSV 다운로드
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">현재 확인 범위: {selectedScopeLabel}</CardTitle></CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="진척도" loading={isLoadingSummary} value={formatPercent(summary.overallProgress)} />
        <SummaryCard title="프로젝트 / 과제" loading={isLoadingSummary} value={`${summary.totalProjects} / ${summary.totalTasks}`} />
        <SummaryCard title="총 지표수" loading={isLoadingSummary} value={String(summary.totalIndicators)} />
        <SummaryCard title="승인 완료" loading={isLoadingSummary} value={String(summary.approvedCount)} className="text-green-600" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>프로젝트별 진척도</CardTitle></CardHeader>
          <CardContent>
            {isLoadingProjects ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredProjects} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="projectName" type="category" width={150} tick={{ fontSize: 12 }} />
                    <RechartsTooltip formatter={(value: number | null | undefined) => [formatPercent(value), "진척도"]} />
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
                    <RechartsTooltip formatter={(value: number | null | undefined, name: string) => [formatPercent(value), name]} />
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
                    {filteredTasks.map((task) => (
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
                    {filteredTasks.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">선택 범위에 데이터가 없습니다.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertCard
          title="위험지표 알림"
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
          loading={isLoadingAlerts}
          items={filteredAlerts}
          emptyText="선택 범위에 위험지표가 없습니다."
        />
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
            {items.slice(0, 5).map((indicator) => (
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
