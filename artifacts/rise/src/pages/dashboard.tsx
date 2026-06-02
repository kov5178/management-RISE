import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListProjects, useListTasks } from "@workspace/api-client-react";
import type { Project, Task } from "@workspace/api-client-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBusinessPeriod, getBusinessYearFromDate } from "@/lib/business-year";

const BUSINESS_MONTHS = [
  { key: "mar", label: "3월" },
  { key: "apr", label: "4월" },
  { key: "may", label: "5월" },
  { key: "jun", label: "6월" },
  { key: "jul", label: "7월" },
  { key: "aug", label: "8월" },
  { key: "sep", label: "9월" },
  { key: "oct", label: "10월" },
  { key: "nov", label: "11월" },
  { key: "dec", label: "12월" },
  { key: "jan", label: "1월" },
  { key: "feb", label: "2월" },
] as const;

type MonthlyPoint = {
  month: string;
  monthLabel?: string | null;
  targetValue: number | string | null;
  actualValue: number | string | null;
  progressRate?: number | string | null;
};

type IndicatorDashboardRow = {
  projectId: number | null;
  projectName: string;
  taskId: number | null;
  taskName: string;
  indicatorId: number;
  indicatorName: string;
  indicatorKey?: string | null;
  targetValue: number | string | null;
  actualValue: number | string | null;
  progressRate: number | string | null;
  note: string | null;
  monthly: MonthlyPoint[];
};

function toNumber(value: unknown, fallback = 0) {
  const numericValue = typeof value === "number" ? value : Number(value ?? fallback);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function formatNumber(value: unknown) {
  return toNumber(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(1)}%`;
}

async function fetchDashboardRows(path: string, params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const response = await fetch(`/api${path}?${searchParams.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("대시보드 데이터를 불러오지 못했습니다.");
  }

  return (await response.json()) as IndicatorDashboardRow[];
}

export default function Dashboard() {
  const currentYear = getBusinessYearFromDate(new Date());
  const { data: projects = [], isLoading: isLoadingProjects } = useListProjects();
  const { data: tasks = [], isLoading: isLoadingTasks } = useListTasks();

  const yearOptions = useMemo(() => {
    const projectYears = projects.flatMap((project: Project) => [project.startYear, project.endYear]);
    const years = new Set<number>([currentYear - 1, currentYear, currentYear + 1, ...projectYears]);
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, projects]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">대시보드</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          프로젝트, 단위과제, 지표명 기준으로 목표 대비 누적 실적을 비교합니다.
        </p>
      </div>

      <ProjectIndicatorDashboard
        currentYear={currentYear}
        projects={projects}
        yearOptions={yearOptions}
        isLoadingProjects={isLoadingProjects}
      />

      <TaskIndicatorDashboard
        currentYear={currentYear}
        projects={projects}
        tasks={tasks}
        yearOptions={yearOptions}
        isLoadingProjects={isLoadingProjects}
        isLoadingTasks={isLoadingTasks}
      />

      <IndicatorTaskPerformanceDashboard
        currentYear={currentYear}
        projects={projects}
        yearOptions={yearOptions}
        isLoadingProjects={isLoadingProjects}
      />
    </div>
  );
}

function ProjectIndicatorDashboard({
  currentYear,
  projects,
  yearOptions,
  isLoadingProjects,
}: {
  currentYear: number;
  projects: Project[];
  yearOptions: number[];
  isLoadingProjects: boolean;
}) {
  const [year, setYear] = useState(String(currentYear));
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(String(projects[0].id));
    }
  }, [projectId, projects]);

  const query = useQuery({
    queryKey: ["dashboard", "project-indicators", year, projectId],
    queryFn: () => fetchDashboardRows("/dashboard/project-indicators", { year, projectId }),
    enabled: Boolean(projectId),
  });

  return (
    <DashboardSection
      title="프로젝트 지표실적 대시보드"
      description={`${year} 사업연도 (${formatBusinessPeriod(Number(year))})`}
      filters={(
        <DashboardFilterControls>
          <FilterSelect label="사업기준연도" value={year} onValueChange={setYear}>
            {yearOptions.map((item) => (
              <SelectItem key={item} value={String(item)}>{item}</SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="프로젝트" value={projectId} onValueChange={setProjectId} minWidth="min-w-[260px]">
            {projects.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
            ))}
          </FilterSelect>
        </DashboardFilterControls>
      )}
      isLoading={isLoadingProjects || query.isLoading}
      rows={query.data ?? []}
      columns={["프로젝트명", "지표명", "목표치", "실적값", "진척도", "비고"]}
      getSummaryValues={(row) => [
        row.projectName,
        row.indicatorName,
        formatNumber(row.targetValue),
        formatNumber(row.actualValue),
        formatPercent(row.progressRate),
        row.note || "-",
      ]}
    />
  );
}

function TaskIndicatorDashboard({
  currentYear,
  projects,
  tasks,
  yearOptions,
  isLoadingProjects,
  isLoadingTasks,
}: {
  currentYear: number;
  projects: Project[];
  tasks: Task[];
  yearOptions: number[];
  isLoadingProjects: boolean;
  isLoadingTasks: boolean;
}) {
  const [year, setYear] = useState(String(currentYear));
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");

  const filteredTasks = useMemo(
    () => tasks.filter((task) => String(task.projectId) === projectId),
    [projectId, tasks],
  );

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(String(projects[0].id));
    }
  }, [projectId, projects]);

  useEffect(() => {
    const firstTask = filteredTasks[0];
    if (!firstTask) {
      setTaskId("");
      return;
    }

    if (!filteredTasks.some((task) => String(task.id) === taskId)) {
      setTaskId(String(firstTask.id));
    }
  }, [filteredTasks, taskId]);

  const query = useQuery({
    queryKey: ["dashboard", "task-indicators", year, projectId, taskId],
    queryFn: () => fetchDashboardRows("/dashboard/task-indicators", { year, projectId, taskId }),
    enabled: Boolean(projectId && taskId),
  });

  return (
    <DashboardSection
      title="단위과제 지표실적 대시보드"
      description={`${year} 사업연도 전체 누적 실적`}
      filters={(
        <DashboardFilterControls>
          <FilterSelect label="사업기준연도" value={year} onValueChange={setYear}>
            {yearOptions.map((item) => (
              <SelectItem key={item} value={String(item)}>{item}</SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="프로젝트" value={projectId} onValueChange={setProjectId} minWidth="min-w-[240px]">
            {projects.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="단위과제" value={taskId} onValueChange={setTaskId} minWidth="min-w-[260px]">
            {filteredTasks.map((task) => (
              <SelectItem key={task.id} value={String(task.id)}>{task.name}</SelectItem>
            ))}
          </FilterSelect>
        </DashboardFilterControls>
      )}
      isLoading={isLoadingProjects || isLoadingTasks || query.isLoading}
      rows={query.data ?? []}
      columns={["단위과제명", "지표명", "목표치", "실적값", "진척도", "비고"]}
      getSummaryValues={(row) => [
        row.taskName,
        row.indicatorName,
        formatNumber(row.targetValue),
        formatNumber(row.actualValue),
        formatPercent(row.progressRate),
        row.note || "-",
      ]}
    />
  );
}

function IndicatorTaskPerformanceDashboard({
  currentYear,
  projects,
  yearOptions,
  isLoadingProjects,
}: {
  currentYear: number;
  projects: Project[];
  yearOptions: number[];
  isLoadingProjects: boolean;
}) {
  const [year, setYear] = useState(String(currentYear));
  const [projectId, setProjectId] = useState("");
  const [indicatorName, setIndicatorName] = useState("");

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(String(projects[0].id));
    }
  }, [projectId, projects]);

  const indicatorOptionsQuery = useQuery({
    queryKey: ["dashboard", "indicator-options", year, projectId],
    queryFn: () => fetchDashboardRows("/dashboard/project-indicators", { year, projectId }),
    enabled: Boolean(projectId),
  });

  const indicatorOptions = useMemo(() => {
    const names = new Set<string>();
    (indicatorOptionsQuery.data ?? []).forEach((row) => {
      const key = String(row.indicatorKey || row.indicatorName || "").trim();
      if (key) names.add(key);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ko-KR"));
  }, [indicatorOptionsQuery.data]);

  useEffect(() => {
    if (indicatorOptions.length === 0) {
      setIndicatorName("");
      return;
    }

    if (!indicatorOptions.includes(indicatorName)) {
      setIndicatorName(indicatorOptions[0]);
    }
  }, [indicatorName, indicatorOptions]);

  const query = useQuery({
    queryKey: ["dashboard", "indicator-task-performance", year, projectId, indicatorName],
    queryFn: () => fetchDashboardRows("/dashboard/indicator-task-performance", {
      year,
      projectId,
      indicatorName,
    }),
    enabled: Boolean(projectId && indicatorName),
  });

  return (
    <DashboardSection
      title="지표별 단위과제실적 대시보드"
      description="공통 지표코드가 도입되기 전까지 지표명 기준으로 관련 단위과제 실적을 비교합니다."
      filters={(
        <DashboardFilterControls>
          <FilterSelect label="사업기준연도" value={year} onValueChange={setYear}>
            {yearOptions.map((item) => (
              <SelectItem key={item} value={String(item)}>{item}</SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="프로젝트" value={projectId} onValueChange={setProjectId} minWidth="min-w-[240px]">
            {projects.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="지표" value={indicatorName} onValueChange={setIndicatorName} minWidth="min-w-[260px]">
            {indicatorOptions.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </FilterSelect>
        </DashboardFilterControls>
      )}
      isLoading={isLoadingProjects || indicatorOptionsQuery.isLoading || query.isLoading}
      rows={query.data ?? []}
      columns={["지표명", "프로젝트명", "단위과제명", "목표치", "실적값", "진척도", "비고"]}
      getSummaryValues={(row) => [
        row.indicatorName,
        row.projectName,
        row.taskName,
        formatNumber(row.targetValue),
        formatNumber(row.actualValue),
        formatPercent(row.progressRate),
        row.note || "-",
      ]}
    />
  );
}

function DashboardSection({
  title,
  description,
  filters,
  isLoading,
  rows,
  columns,
  getSummaryValues,
}: {
  title: string;
  description: string;
  filters: ReactNode;
  isLoading: boolean;
  rows: IndicatorDashboardRow[];
  columns: string[];
  getSummaryValues: (row: IndicatorDashboardRow) => string[];
}) {
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            {filters}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <IndicatorCardSkeleton />
          ) : rows.length === 0 ? (
            <div className="rounded-md border py-10 text-center text-sm text-muted-foreground">
              등록된 지표가 없습니다.
            </div>
          ) : (
            <div className="grid gap-4">
              {rows.map((row) => (
                <IndicatorPerformanceCard
                  key={`${row.taskId ?? "project"}-${row.indicatorId}`}
                  row={row}
                  columns={columns}
                  values={getSummaryValues(row)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function DashboardFilterControls({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {children}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  minWidth = "min-w-[150px]",
  children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  minWidth?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={minWidth}>
          <SelectValue placeholder="선택" />
        </SelectTrigger>
        <SelectContent>
          {children}
        </SelectContent>
      </Select>
    </label>
  );
}

function IndicatorPerformanceCard({
  row,
  columns,
  values,
}: {
  row: IndicatorDashboardRow;
  columns: string[];
  values: string[];
}) {
  return (
    <article className="overflow-hidden rounded-md border bg-card">
      <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((column, index) => (
          <div key={`${row.indicatorId}-${column}`} className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">{column}</div>
            <div className="mt-1 truncate text-sm font-medium tabular-nums">{values[index] ?? "-"}</div>
          </div>
        ))}
      </div>
      <div className="p-4">
        <IndicatorMonthlyChart data={row.monthly} />
      </div>
    </article>
  );
}

function IndicatorMonthlyChart({ data }: { data: MonthlyPoint[] }) {
  const dataByMonth = new Map(data.map((point) => [point.month, point]));
  const chartData = BUSINESS_MONTHS.map((month) => {
    const point = dataByMonth.get(month.key);
    return {
      month: month.label,
      targetValue: toNumber(point?.targetValue),
      actualValue: toNumber(point?.actualValue),
      progressRate: toNumber(point?.progressRate),
    };
  });

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={54} />
          <RechartsTooltip
            formatter={(value, name) => [
              formatNumber(value),
              name === "targetValue" ? "목표값" : "실적값",
            ]}
          />
          <Legend formatter={(value) => (value === "targetValue" ? "목표값" : "실적값")} />
          <Line
            type="monotone"
            dataKey="targetValue"
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="actualValue"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function IndicatorCardSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-md border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-9 w-full" />
            ))}
          </div>
          <Skeleton className="mt-4 h-[260px] w-full" />
        </div>
      ))}
    </div>
  );
}
