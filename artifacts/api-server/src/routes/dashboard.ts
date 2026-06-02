import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import {
  db,
  projectsTable,
  tasksTable,
  indicatorsTable,
  indicatorTargetsTable,
  indicatorResultsTable,
} from "@workspace/db";
import {
  GetDashboardSummaryQueryParams,
  GetDashboardProjectsQueryParams,
  GetDashboardTasksQueryParams,
  GetDashboardAlertsQueryParams,
  GetDashboardTrendQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const BUSINESS_MONTHS = [
  { month: "mar", resultKey: "marValue", monthLabel: "3월" },
  { month: "apr", resultKey: "aprValue", monthLabel: "4월" },
  { month: "may", resultKey: "mayValue", monthLabel: "5월" },
  { month: "jun", resultKey: "junValue", monthLabel: "6월" },
  { month: "jul", resultKey: "julValue", monthLabel: "7월" },
  { month: "aug", resultKey: "augValue", monthLabel: "8월" },
  { month: "sep", resultKey: "sepValue", monthLabel: "9월" },
  { month: "oct", resultKey: "octValue", monthLabel: "10월" },
  { month: "nov", resultKey: "novValue", monthLabel: "11월" },
  { month: "dec", resultKey: "decValue", monthLabel: "12월" },
  { month: "jan", resultKey: "janValue", monthLabel: "1월" },
  { month: "feb", resultKey: "febValue", monthLabel: "2월" },
] as const;

type ResultMonthKey = (typeof BUSINESS_MONTHS)[number]["resultKey"];

function toNumber(value: unknown, fallback = 0) {
  const numericValue = typeof value === "number" ? value : Number(value ?? fallback);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function parseNumberParam(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function calculateMonthlyTrend(
  targetValue: unknown,
  result: Partial<Record<ResultMonthKey, unknown>> | undefined,
) {
  const annualTarget = toNumber(targetValue);
  let cumulativeActual = 0;

  return BUSINESS_MONTHS.map((month, index) => {
    cumulativeActual += toNumber(result?.[month.resultKey]);
    const monthlyTargetValue = roundOne((annualTarget * (index + 1)) / BUSINESS_MONTHS.length);
    const monthlyActualValue = roundOne(cumulativeActual);

    return {
      month: month.month,
      monthLabel: month.monthLabel,
      targetValue: monthlyTargetValue,
      actualValue: monthlyActualValue,
      progressRate: calculateProgress(monthlyActualValue, monthlyTargetValue, undefined),
    };
  });
}

function calculateProgress(actualValue: number, targetValue: number, storedProgress: unknown) {
  const stored = typeof storedProgress === "number" || typeof storedProgress === "string"
    ? Number(storedProgress)
    : NaN;
  if (Number.isFinite(stored)) return roundOne(stored);
  return targetValue > 0 ? roundOne((actualValue / targetValue) * 100) : 0;
}

function getIndicatorKey(indicator: typeof indicatorsTable.$inferSelect) {
  return indicator.name.trim();
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const query = GetDashboardSummaryQueryParams.safeParse(req.query);
  const year = query.success && query.data.year ? query.data.year : new Date().getFullYear();

  const [{ totalProjects }] = await db.select({ totalProjects: count() }).from(projectsTable);
  const [{ totalTasks }] = await db.select({ totalTasks: count() }).from(tasksTable);
  const [{ totalIndicators }] = await db.select({ totalIndicators: count() }).from(indicatorsTable);

  const results = await db
    .select()
    .from(indicatorResultsTable)
    .where(eq(indicatorResultsTable.year, year));

  const approvedCount = results.filter((r) => r.status === "approved").length;
  const pendingCount = results.filter((r) => ["submitted", "reviewing"].includes(r.status)).length;
  const revisionCount = results.filter((r) => r.status === "revision_requested").length;

  const validProgress = results
    .filter((r) => r.progressRate != null)
    .map((r) => r.progressRate as number);
  const overallProgress =
    validProgress.length > 0
      ? validProgress.reduce((a, b) => a + b, 0) / validProgress.length
      : 0;

  res.json({
    totalProjects,
    totalTasks,
    totalIndicators,
    overallProgress: Math.round(overallProgress * 10) / 10,
    approvedCount,
    pendingCount,
    revisionCount,
    year,
  });
});

router.get("/dashboard/projects", async (req, res): Promise<void> => {
  const query = GetDashboardProjectsQueryParams.safeParse(req.query);
  const year = query.success && query.data.year ? query.data.year : new Date().getFullYear();

  const projects = await db.select().from(projectsTable);
  const tasks = await db.select().from(tasksTable);
  const indicators = await db.select().from(indicatorsTable);
  const results = await db
    .select()
    .from(indicatorResultsTable)
    .where(eq(indicatorResultsTable.year, year));

  const data = projects.map((project) => {
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    const taskIds = projectTasks.map((t) => t.id);
    const projectIndicators = indicators.filter((i) => taskIds.includes(i.taskId));
    const indicatorIds = projectIndicators.map((i) => i.id);
    const projectResults = results.filter((r) => indicatorIds.includes(r.indicatorId));

    const validProgress = projectResults
      .filter((r) => r.progressRate != null)
      .map((r) => r.progressRate as number);
    const progress =
      validProgress.length > 0
        ? validProgress.reduce((a, b) => a + b, 0) / validProgress.length
        : 0;

    const approvedCount = projectResults.filter((r) => r.status === "approved").length;
    const isOverTarget = validProgress.some((p) => p > 100);

    return {
      projectId: project.id,
      projectName: project.name,
      progress: Math.round(progress * 10) / 10,
      taskCount: projectTasks.length,
      indicatorCount: projectIndicators.length,
      approvedCount,
      isOverTarget,
    };
  });

  res.json(data);
});

router.get("/dashboard/tasks", async (req, res): Promise<void> => {
  const query = GetDashboardTasksQueryParams.safeParse(req.query);
  const year = query.success && query.data.year ? query.data.year : new Date().getFullYear();

  const projects = await db.select().from(projectsTable);
  const tasks = await db.select().from(tasksTable);
  const indicators = await db.select().from(indicatorsTable);
  const results = await db
    .select()
    .from(indicatorResultsTable)
    .where(eq(indicatorResultsTable.year, year));
  const data = tasks.map((task) => {
    const project = projects.find((p) => p.id === task.projectId);
    const taskIndicators = indicators.filter((i) => i.taskId === task.id);
    const indicatorIds = taskIndicators.map((i) => i.id);
    const taskResults = results.filter((r) => indicatorIds.includes(r.indicatorId));

    const validProgress = taskResults
      .filter((r) => r.progressRate != null)
      .map((r) => r.progressRate as number);
    const progress =
      validProgress.length > 0
        ? validProgress.reduce((a, b) => a + b, 0) / validProgress.length
        : 0;

    const approvedCount = taskResults.filter((r) => r.status === "approved").length;
    const isOverTarget = validProgress.some((p) => p > 100);

    return {
      taskId: task.id,
      taskName: task.name,
      projectId: task.projectId,
      projectName: project?.name ?? "",
      progress: Math.round(progress * 10) / 10,
      indicatorCount: taskIndicators.length,
      approvedCount,
      isOverTarget,
    };
  });

  res.json(data);
});

router.get("/dashboard/project-indicators", async (req, res): Promise<void> => {
  const year = parseNumberParam(req.query.year) ?? new Date().getFullYear();
  const projectId = parseNumberParam(req.query.projectId);

  const projects = await db.select().from(projectsTable);
  const tasks = await db.select().from(tasksTable);
  const indicators = await db.select().from(indicatorsTable);
  const targets = await db
    .select()
    .from(indicatorTargetsTable)
    .where(eq(indicatorTargetsTable.year, year));
  const results = await db
    .select()
    .from(indicatorResultsTable)
    .where(eq(indicatorResultsTable.year, year));

  const filteredTasks = projectId ? tasks.filter((task) => task.projectId === projectId) : tasks;
  const taskIds = new Set(filteredTasks.map((task) => task.id));
  const projectIndicators = indicators.filter((indicator) => taskIds.has(indicator.taskId));

  const data = projectIndicators.map((indicator) => {
    const task = tasks.find((item) => item.id === indicator.taskId);
    const project = projects.find((item) => item.id === task?.projectId);
    const target = targets.find((item) => item.indicatorId === indicator.id);
    const result = results.find((item) => item.indicatorId === indicator.id);
    const targetValue = toNumber(target?.targetValue);
    const monthly = calculateMonthlyTrend(targetValue, result);
    const actualValue = monthly.at(-1)?.actualValue ?? 0;

    return {
      projectId: project?.id ?? null,
      projectName: project?.name ?? "",
      taskId: task?.id ?? null,
      taskName: task?.name ?? "",
      indicatorId: indicator.id,
      indicatorName: indicator.name,
      indicatorKey: getIndicatorKey(indicator),
      targetValue,
      actualValue: roundOne(actualValue),
      progressRate: calculateProgress(actualValue, targetValue, undefined),
      note: result?.note ?? target?.note ?? "",
      monthly,
    };
  });

  res.json(data);
});

router.get("/dashboard/task-indicators", async (req, res): Promise<void> => {
  const year = parseNumberParam(req.query.year) ?? new Date().getFullYear();
  const projectId = parseNumberParam(req.query.projectId);
  const taskId = parseNumberParam(req.query.taskId);

  const projects = await db.select().from(projectsTable);
  const tasks = await db.select().from(tasksTable);
  const indicators = await db.select().from(indicatorsTable);
  const targets = await db
    .select()
    .from(indicatorTargetsTable)
    .where(eq(indicatorTargetsTable.year, year));
  const results = await db
    .select()
    .from(indicatorResultsTable)
    .where(eq(indicatorResultsTable.year, year));

  const filteredTasks = tasks.filter((task) => {
    if (taskId && task.id !== taskId) return false;
    if (projectId && task.projectId !== projectId) return false;
    return true;
  });
  const taskIds = new Set(filteredTasks.map((task) => task.id));
  const taskIndicators = indicators.filter((indicator) => taskIds.has(indicator.taskId));

  const data = taskIndicators.map((indicator) => {
    const task = tasks.find((item) => item.id === indicator.taskId);
    const project = projects.find((item) => item.id === task?.projectId);
    const target = targets.find((item) => item.indicatorId === indicator.id);
    const result = results.find((item) => item.indicatorId === indicator.id);
    const targetValue = toNumber(target?.targetValue);
    const monthly = calculateMonthlyTrend(targetValue, result);
    const actualValue = monthly.at(-1)?.actualValue ?? 0;

    return {
      projectId: project?.id ?? null,
      projectName: project?.name ?? "",
      taskId: task?.id ?? null,
      taskName: task?.name ?? "",
      indicatorId: indicator.id,
      indicatorName: indicator.name,
      indicatorKey: getIndicatorKey(indicator),
      targetValue,
      actualValue: roundOne(actualValue),
      progressRate: calculateProgress(actualValue, targetValue, undefined),
      note: result?.note ?? target?.note ?? "",
      monthly,
    };
  });

  res.json(data);
});

router.get("/dashboard/indicator-task-performance", async (req, res): Promise<void> => {
  const year = parseNumberParam(req.query.year) ?? new Date().getFullYear();
  const projectId = parseNumberParam(req.query.projectId);
  const rawIndicatorName = Array.isArray(req.query.indicatorName)
    ? req.query.indicatorName[0]
    : req.query.indicatorName;
  const indicatorName = String(rawIndicatorName ?? "").trim();

  const projects = await db.select().from(projectsTable);
  const tasks = await db.select().from(tasksTable);
  const indicators = await db.select().from(indicatorsTable);
  const targets = await db
    .select()
    .from(indicatorTargetsTable)
    .where(eq(indicatorTargetsTable.year, year));
  const results = await db
    .select()
    .from(indicatorResultsTable)
    .where(eq(indicatorResultsTable.year, year));

  const filteredTasks = tasks.filter((task) => !projectId || task.projectId === projectId);
  const taskIds = new Set(filteredTasks.map((task) => task.id));
  const filteredIndicators = indicators.filter((indicator) => {
    if (!taskIds.has(indicator.taskId)) return false;
    if (!indicatorName) return true;
    return getIndicatorKey(indicator) === indicatorName;
  });

  const data = filteredIndicators.map((indicator) => {
    const task = tasks.find((item) => item.id === indicator.taskId);
    const project = projects.find((item) => item.id === task?.projectId);
    const target = targets.find((item) => item.indicatorId === indicator.id);
    const result = results.find((item) => item.indicatorId === indicator.id);
    const targetValue = toNumber(target?.targetValue);
    const monthly = calculateMonthlyTrend(targetValue, result);
    const actualValue = monthly.at(-1)?.actualValue ?? 0;

    return {
      projectId: project?.id ?? null,
      projectName: project?.name ?? "",
      taskId: task?.id ?? null,
      taskName: task?.name ?? "",
      indicatorId: indicator.id,
      indicatorName: indicator.name,
      indicatorKey: getIndicatorKey(indicator),
      targetValue,
      actualValue: roundOne(actualValue),
      progressRate: calculateProgress(actualValue, targetValue, undefined),
      note: result?.note ?? target?.note ?? "",
      monthly,
    };
  });

  res.json(data);
});

router.get("/dashboard/indicator-monthly-trend", async (req, res): Promise<void> => {
  const year = parseNumberParam(req.query.year) ?? new Date().getFullYear();
  const indicatorId = parseNumberParam(req.query.indicatorId);

  if (!indicatorId) {
    res.status(400).json({ message: "indicatorId is required." });
    return;
  }

  const projects = await db.select().from(projectsTable);
  const tasks = await db.select().from(tasksTable);
  const indicators = await db.select().from(indicatorsTable);
  const target = await db
    .select()
    .from(indicatorTargetsTable)
    .where(eq(indicatorTargetsTable.year, year));
  const result = await db
    .select()
    .from(indicatorResultsTable)
    .where(eq(indicatorResultsTable.year, year));

  const indicator = indicators.find((item) => item.id === indicatorId);
  const task = tasks.find((item) => item.id === indicator?.taskId);
  const project = projects.find((item) => item.id === task?.projectId);
  const indicatorTarget = target.find((item) => item.indicatorId === indicatorId);
  const indicatorResult = result.find((item) => item.indicatorId === indicatorId);
  const targetValue = toNumber(indicatorTarget?.targetValue);
  const monthly = calculateMonthlyTrend(targetValue, indicatorResult);
  const actualValue = monthly.at(-1)?.actualValue ?? 0;

  res.json({
    projectId: project?.id ?? null,
    projectName: project?.name ?? "",
    taskId: task?.id ?? null,
    taskName: task?.name ?? "",
    indicatorId,
    indicatorName: indicator?.name ?? "",
    indicatorKey: indicator ? getIndicatorKey(indicator) : "",
    targetValue,
    actualValue: roundOne(actualValue),
    progressRate: calculateProgress(actualValue, targetValue, undefined),
    note: indicatorResult?.note ?? indicatorTarget?.note ?? "",
    monthly,
  });
});

router.get("/dashboard/alerts", async (req, res): Promise<void> => {
  const query = GetDashboardAlertsQueryParams.safeParse(req.query);
  const year = query.success && query.data.year ? query.data.year : new Date().getFullYear();

  const projects = await db.select().from(projectsTable);
  const tasks = await db.select().from(tasksTable);
  const indicators = await db.select().from(indicatorsTable);
  const results = await db
    .select()
    .from(indicatorResultsTable)
    .where(eq(indicatorResultsTable.year, year));

  function getNames(indicatorId: number) {
    const indicator = indicators.find((i) => i.id === indicatorId);
    const task = tasks.find((t) => t.id === indicator?.taskId);
    const project = projects.find((p) => p.id === task?.projectId);
    return {
      indicatorName: indicator?.name ?? "",
      taskName: task?.name ?? "",
      projectName: project?.name ?? "",
    };
  }

  // at risk: progress < 70% and not approved
  const atRiskIndicators = results
    .filter((r) => r.progressRate != null && (r.progressRate as number) < 70 && r.status !== "approved")
    .map((r) => ({
      indicatorId: r.indicatorId,
      ...getNames(r.indicatorId),
      progress: r.progressRate,
      status: r.status,
    }));

  // revision requested
  const revisionRequestedIndicators = results
    .filter((r) => r.status === "revision_requested")
    .map((r) => ({
      indicatorId: r.indicatorId,
      ...getNames(r.indicatorId),
      progress: r.progressRate,
      status: r.status,
    }));

  res.json({ atRiskIndicators, revisionRequestedIndicators });
});

router.get("/dashboard/trend", async (req, res): Promise<void> => {
  const query = GetDashboardTrendQueryParams.safeParse(req.query);
  const projectId = query.success ? query.data.projectId : null;
  const year = query.success && query.data.year ? query.data.year : 2025;

  const tasks = await db.select().from(tasksTable);
  const indicators = await db.select().from(indicatorsTable);
  const targets = await db.select().from(indicatorTargetsTable);
  const results = await db
    .select()
    .from(indicatorResultsTable)
    .where(eq(indicatorResultsTable.year, year));

  // filter by project if given
  let filteredIndicatorIds: number[];
  if (projectId) {
    const projectTasks = tasks.filter((t) => t.projectId === projectId);
    const taskIds = projectTasks.map((t) => t.id);
    filteredIndicatorIds = indicators.filter((i) => taskIds.includes(i.taskId)).map((i) => i.id);
  } else {
    filteredIndicatorIds = indicators.map((i) => i.id);
  }

  const yearTargets = targets.filter((t) => filteredIndicatorIds.includes(t.indicatorId) && t.year === year);
  const yearResults = results.filter((r) => filteredIndicatorIds.includes(r.indicatorId));

  // overall target average (constant across months)
  const avgTarget =
    yearTargets.filter((t) => t.targetValue != null).length > 0
      ? Math.round(
          (yearTargets.reduce((a, b) => a + (b.targetValue ?? 0), 0) /
            yearTargets.filter((t) => t.targetValue != null).length) *
            100
        ) / 100
      : null;

  // Compute final avg progress rate across all results for the year
  const withProgress = yearResults.filter((r) => r.progressRate != null);
  const finalAvgProgress =
    withProgress.length > 0
      ? Math.round((withProgress.reduce((a, b) => a + (b.progressRate ?? 0), 0) / withProgress.length) * 10) / 10
      : null;  // Business-year order: Mar through Feb.
  const MONTH_WEIGHTS = [0.0, 0.04, 0.12, 0.22, 0.34, 0.45, 0.55, 0.65, 0.74, 0.83, 0.91, 1.0];
  const TARGET_WEIGHTS = [0.08, 0.17, 0.25, 0.33, 0.42, 0.50, 0.58, 0.67, 0.75, 0.83, 0.92, 1.0];

  const MONTH_LABELS = ["3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월", "1월", "2월"];

  const trend = MONTH_LABELS.map((label, idx) => {
    const actualProgress =
      finalAvgProgress != null
        ? Math.round(finalAvgProgress * MONTH_WEIGHTS[idx] * 10) / 10
        : null;
    const targetProgress = Math.round(100 * TARGET_WEIGHTS[idx] * 10) / 10;

    return {
      month: label,
      targetProgress,
      actualProgress,
      targetValue: avgTarget,
    };
  });

  res.json(trend);
});

export default router;
