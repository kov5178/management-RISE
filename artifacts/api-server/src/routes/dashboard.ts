import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
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
