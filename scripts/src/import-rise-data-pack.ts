import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  projectsTable,
  tasksTable,
  indicatorsTable,
  indicatorTargetsTable,
  indicatorResultsTable,
} from "@workspace/db";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data/rise");

const monthValues = {
  marValue: 0,
  aprValue: 0,
  mayValue: 0,
  junValue: 0,
  julValue: 0,
  augValue: 0,
  sepValue: 0,
  octValue: 0,
  novValue: 0,
  decValue: 0,
  janValue: 0,
  febValue: 0,
};
const monthlyKeys = Object.keys(monthValues) as (keyof typeof monthValues)[];

type CsvRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  values.push(value);
  return values;
}

function readCsv(fileName: string): CsvRow[] {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required CSV file: ${filePath}`);
  }

  const csv = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(lines[0] ?? "");

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseNumber(value: unknown): number | null {
  const normalized = String(value ?? "").replace(/,/g, "").replace(/%/g, "").trim();
  if (!normalized || normalized === "-") return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseBoolean(value: unknown): boolean {
  return String(value ?? "").toLowerCase() === "true";
}

function progressRate(actualValue: number | null, targetValue: number | null): number | null {
  if (actualValue == null || targetValue == null || targetValue === 0) return null;
  return Math.round((actualValue / targetValue) * 1000) / 10;
}

async function getTargetValue(indicatorId: number, year: number): Promise<number | null> {
  const [target] = await db
    .select()
    .from(indicatorTargetsTable)
    .where(and(eq(indicatorTargetsTable.indicatorId, indicatorId), eq(indicatorTargetsTable.year, year)));
  return target?.targetValue ?? null;
}

async function recalculateAutoParentsForYear(year: number): Promise<void> {
  const parents = await db.select().from(indicatorsTable).where(eq(indicatorsTable.calculationMode, "AUTO_FROM_CHILDREN"));
  const orderedParents = parents.sort((left, right) => right.id - left.id);

  for (const parent of orderedParents) {
    const children = await db.select().from(indicatorsTable).where(eq(indicatorsTable.parentId, parent.id));
    const childResults = [];

    for (const child of children) {
      const [result] = await db
        .select()
        .from(indicatorResultsTable)
        .where(and(eq(indicatorResultsTable.indicatorId, child.id), eq(indicatorResultsTable.year, year)));
      if (result) childResults.push(result);
    }

    if (childResults.length === 0) continue;

    const monthly = Object.fromEntries(
      monthlyKeys.map((key) => [key, childResults.reduce((sum, result) => sum + Number(result[key] ?? 0), 0)]),
    ) as typeof monthValues;
    const calculatedValue = childResults.reduce((sum, result) => sum + Number(result.calculatedValue ?? 0), 0);
    const targetValue = await getTargetValue(parent.id, year);

    await db
      .insert(indicatorResultsTable)
      .values({
        indicatorId: parent.id,
        year,
        ...monthly,
        calculatedValue,
        progressRate: progressRate(calculatedValue, targetValue),
        status: childResults.every((result) => result.status === "submitted") ? "submitted" : "draft",
        note: "하위지표 실적 기반 자동산출",
      })
      .onConflictDoUpdate({
        target: [indicatorResultsTable.indicatorId, indicatorResultsTable.year],
        set: {
          ...monthly,
          calculatedValue,
          progressRate: progressRate(calculatedValue, targetValue),
          status: childResults.every((result) => result.status === "submitted") ? "submitted" : "draft",
          note: "하위지표 실적 기반 자동산출",
          updatedAt: new Date(),
        },
      });
  }
}

async function main(): Promise<void> {
  const projectRows = readCsv("projects.csv");
  const taskRows = readCsv("tasks.csv");
  const indicatorRows = readCsv("indicators.csv");
  const targetRows = readCsv("indicator_targets.csv").filter((row) => {
    const year = Number(row.year);
    return year >= 2025 && year <= 2029 && parseNumber(row.target_value) != null;
  });
  const actualRows = readCsv("indicator_actuals.csv").filter(
    (row) => Number(row.year) === 2025 && parseNumber(row.actual_value) != null,
  );

  await db.delete(indicatorResultsTable);
  await db.delete(indicatorTargetsTable);
  await db.delete(indicatorsTable);
  await db.delete(tasksTable);
  await db.delete(projectsTable);

  const projectBySourceId = new Map<string, number>();
  const projectByName = new Map<string, number>();
  const taskBySourceId = new Map<string, number>();
  const taskByName = new Map<string, number>();
  const indicatorBySourceId = new Map<string, number>();

  for (const row of projectRows) {
    const [project] = await db
      .insert(projectsTable)
      .values({
        name: row.project_name,
        description: "실제 성과지표 엑셀 데이터팩에서 가져온 RISE 프로젝트입니다.",
        startYear: 2025,
        endYear: 2029,
        status: "active",
      })
      .returning();
    projectBySourceId.set(row.project_id, project.id);
    projectByName.set(row.project_name, project.id);
  }

  for (const row of taskRows) {
    const projectId = projectBySourceId.get(row.project_id) ?? projectByName.get(row.project_name);
    if (!projectId) throw new Error(`Project not found for task ${row.task_id}`);

    const [task] = await db
      .insert(tasksTable)
      .values({
        projectId,
        name: row.task_name,
        description: "실제 성과지표 엑셀 데이터팩에서 가져온 단위과제입니다.",
        status: "active",
      })
      .returning();
    taskBySourceId.set(row.task_id, task.id);
    taskByName.set(`${row.project_name}::${row.task_name}`, task.id);
  }

  for (const [index, row] of indicatorRows.entries()) {
    const taskId = taskByName.get(`${row.project_name}::${row.task_name}`);
    if (!taskId) throw new Error(`Task not found for indicator ${row.indicator_id}`);

    const calculationMode = row.calculation_mode || "DIRECT_INPUT";
    const indicatorType = row.indicator_level === "PARENT" ? "parent" : "child";
    const [indicator] = await db
      .insert(indicatorsTable)
      .values({
        taskId,
        sourceIndicatorId: row.indicator_id,
        indicatorType,
        indicatorScope: row.indicator_scope,
        sourceScopeName: row.source_scope_name || null,
        calculationMode,
        sourceLevelConfidence: row.source_level_confidence || "EXPLICIT",
        sourceLevelName: row.source_level_name || null,
        sourceExcelRow: parseNumber(row.source_excel_row),
        isRegionalAggregate: parseBoolean(row.is_regional_aggregate),
        formulaType: row.formula_type || null,
        baselineValue: parseNumber(row.baseline_value),
        ownerName: row.owner || null,
        name: row.indicator_name,
        unit: row.unit || null,
        formula: calculationMode === "DIRECT_INPUT" ? "sum_monthly_values" : null,
        weight: parseNumber(row.source_weight),
        description: row.note || `source_excel_row=${row.source_excel_row || index + 1}`,
      })
      .returning();
    indicatorBySourceId.set(row.indicator_id, indicator.id);
  }

  for (const row of indicatorRows.filter((indicator) => indicator.parent_indicator_id)) {
    const indicatorId = indicatorBySourceId.get(row.indicator_id);
    const parentId = indicatorBySourceId.get(row.parent_indicator_id);
    if (!indicatorId || !parentId) continue;
    await db.update(indicatorsTable).set({ parentId, updatedAt: new Date() }).where(eq(indicatorsTable.id, indicatorId));
  }

  for (const row of targetRows) {
    const indicatorId = indicatorBySourceId.get(row.indicator_id);
    const targetValue = parseNumber(row.target_value);
    if (!indicatorId || targetValue == null) continue;

    await db.insert(indicatorTargetsTable).values({
      indicatorId,
      year: Number(row.year),
      targetValue,
      note: `source_sheet=${row.source_sheet}; source_excel_row=${row.source_excel_row}`,
    });
  }

  for (const row of actualRows) {
    const indicatorId = indicatorBySourceId.get(row.indicator_id);
    const actualValue = parseNumber(row.actual_value);
    if (!indicatorId || actualValue == null) continue;

    const [indicator] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, indicatorId));
    if (indicator?.calculationMode === "AUTO_FROM_CHILDREN") continue;

    const targetValue = await getTargetValue(indicatorId, Number(row.year));
    await db.insert(indicatorResultsTable).values({
      indicatorId,
      year: Number(row.year),
      ...monthValues,
      marValue: actualValue,
      calculatedValue: actualValue,
      progressRate: progressRate(actualValue, targetValue),
      status: "submitted",
      note: `초기 실적 import: ${row.value_source || row.source_sheet || "indicator_actuals.csv"}`,
    });
  }

  await recalculateAutoParentsForYear(2025);

  console.log(
    `Imported RISE data pack: ${projectRows.length} projects, ${taskRows.length} tasks, ${indicatorRows.length} indicators, ${targetRows.length} targets, ${actualRows.length} actual rows.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
