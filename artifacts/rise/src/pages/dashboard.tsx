import { useGetDashboardSummary, useGetDashboardProjects, useGetDashboardTasks, useGetDashboardAlerts, useGetDashboardTrend } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { exportToCsv } from "@/lib/export-excel";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, FileWarning, RefreshCcw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const LATEST_DATA_YEAR = 2025;

export default function Dashboard() {
  const currentYear = LATEST_DATA_YEAR;
  
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({ year: currentYear });
  const { data: projects, isLoading: isLoadingProjects } = useGetDashboardProjects({ year: currentYear });
  const { data: tasks, isLoading: isLoadingTasks } = useGetDashboardTasks({ year: currentYear });
  const { data: alerts, isLoading: isLoadingAlerts } = useGetDashboardAlerts({ year: currentYear });
  const { data: trend, isLoading: isLoadingTrend } = useGetDashboardTrend({});

  const handleExport = () => {
    if (tasks) {
      exportToCsv(`dashboard_tasks_${currentYear}`, tasks.map(t => ({
        '프로젝트명': t.projectName,
        '단위과제명': t.taskName,
        '진척도(%)': t.progress,
        '승인된 지표수': t.approvedCount,
        '총 지표수': t.indicatorCount,
        '누락된 증빙수': t.missingEvidenceCount
      })));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">대시보드</h2>
          <p className="text-muted-foreground">{currentYear}년도 RISE 사업 성과 종합 현황</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          엑셀 다운로드
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 진척도</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summary?.overallProgress.toFixed(1)}%</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 프로젝트 / 과제</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summary?.totalProjects} / {summary?.totalTasks}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 지표 수</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summary?.totalIndicators}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">승인 완료 건수</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold text-green-600">{summary?.approvedCount}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Project Progress Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>프로젝트별 진척도</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingProjects ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projects} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="projectName" type="category" width={150} tick={{fontSize: 12}} />
                    <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '진척도']} />
                    <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>월별 목표 대비 실적 추이 ({currentYear})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTrend ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={40} />
                    <RechartsTooltip formatter={(value: number, name: string) => [`${value?.toFixed(1)}%`, name]} />
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
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>단위과제별 진척도</CardTitle>
          </CardHeader>
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
                      <TableHead className="text-right">증빙누락</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks?.map((task) => (
                      <TableRow key={task.taskId}>
                        <TableCell className="font-medium">{task.taskName}</TableCell>
                        <TableCell className="text-muted-foreground">{task.projectName}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {task.progress.toFixed(1)}%
                            {task.isOverTarget && <Badge variant="secondary" className="bg-green-100 text-green-800">초과달성</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{task.approvedCount} / {task.indicatorCount}</TableCell>
                        <TableCell className="text-right">
                          {task.missingEvidenceCount > 0 ? (
                            <span className="text-red-500 font-bold">{task.missingEvidenceCount}건</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!tasks || tasks.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">데이터가 없습니다.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                위험지표 알림
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAlerts ? <Skeleton className="h-20 w-full" /> : (
                <div className="space-y-3">
                  {alerts?.atRiskIndicators.slice(0, 3).map((indicator) => (
                    <div key={indicator.indicatorId} className="flex justify-between items-start border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <div className="font-medium text-sm">{indicator.indicatorName}</div>
                        <div className="text-xs text-muted-foreground">{indicator.taskName}</div>
                      </div>
                      <div className="text-xs font-bold text-red-500">{indicator.progress?.toFixed(1)}%</div>
                    </div>
                  ))}
                  {(!alerts?.atRiskIndicators || alerts.atRiskIndicators.length === 0) && (
                    <div className="text-sm text-muted-foreground text-center py-2">위험지표가 없습니다.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-orange-500" />
                증빙누락 알림
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAlerts ? <Skeleton className="h-20 w-full" /> : (
                <div className="space-y-3">
                  {alerts?.missingEvidenceIndicators.slice(0, 3).map((indicator) => (
                    <div key={indicator.indicatorId} className="flex justify-between items-start border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <div className="font-medium text-sm">{indicator.indicatorName}</div>
                        <div className="text-xs text-muted-foreground">{indicator.taskName}</div>
                      </div>
                    </div>
                  ))}
                  {(!alerts?.missingEvidenceIndicators || alerts.missingEvidenceIndicators.length === 0) && (
                    <div className="text-sm text-muted-foreground text-center py-2">증빙누락이 없습니다.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCcw className="w-5 h-5 text-blue-500" />
                보완요청 알림
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAlerts ? <Skeleton className="h-20 w-full" /> : (
                <div className="space-y-3">
                  {alerts?.revisionRequestedIndicators.slice(0, 3).map((indicator) => (
                    <div key={indicator.indicatorId} className="flex justify-between items-start border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <div className="font-medium text-sm">{indicator.indicatorName}</div>
                        <div className="text-xs text-muted-foreground">{indicator.taskName}</div>
                      </div>
                    </div>
                  ))}
                  {(!alerts?.revisionRequestedIndicators || alerts.revisionRequestedIndicators.length === 0) && (
                    <div className="text-sm text-muted-foreground text-center py-2">보완요청 건이 없습니다.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
