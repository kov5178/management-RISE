import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  projectsTable,
  tasksTable,
  indicatorsTable,
  indicatorComponentsTable,
  indicatorTargetsTable,
  indicatorResultsTable,
  type IndicatorCalculationMode,
  type IndicatorComponentRole,
  type IndicatorLevel,
  type IndicatorScope,
} from "../lib/db/src/index";

type CsvRow = Record<string, string>;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const importDir = join(repoRoot, "data", "import");
const defaultYears = { startYear: 2025, endYear: 2029 };

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  const [headerRow, ...dataRows] = rows;
  if (!headerRow) {
    return [];
  }

  const headers = headerRow.map((header) => header.replace(/^\uFEFF/, "").trim());
  return dataRows.map((dataRow) => Object.fromEntries(
    headers.map((header, index) => [header, dataRow[index]?.trim() ?? ""]),
  ));
}

async function readCsv(fileName: string): Promise<CsvRow[]> {
  const csv = await readFile(join(importDir, fileName), "utf8");
  return parseCsv(csv);
}

function required(row: CsvRow, key: string, fileName: string): string {
  const value = row[key]?.trim();
  if (!value) {
    throw new Error(`${fileName}: missing required column value ${key}`);
  }
  return value;
}

function nullableText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${trimmed}`);
  }
  return parsed;
}

function integerOrNull(value: string | undefined): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function booleanValue(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y";
}

function reviewRequired(row: CsvRow): boolean {
  return booleanValue(row.review_required)
    || row.source_level_confidence?.trim() === "INFERRED"
    || row.formula_level_confidence?.trim() === "INFERRED"
    || row.component_confidence?.trim() === "INFERRED"
    || Boolean(row.review_note?.trim());
}

function indicatorScope(value: string | undefined): IndicatorScope {
  if (value === "CHUNGBUK" || value === "UNIVERSITY") {
    return value;
  }
  return "PROJECT";
}

function indicatorLevel(row: CsvRow): IndicatorLevel {
  return row.indicator_level === "PARENT" ? "PARENT" : "CHILD";
}

function calculationMode(row: CsvRow): IndicatorCalculationMode {
  if (row.calculation_mode === "AUTO_FROM_CHILDREN") {
    return "AUTO_FROM_CHILDREN";
  }
  return "DIRECT_INPUT";
}

function componentRole(value: string | undefined): IndicatorComponentRole {
  if (value === "NUMERATOR_VALUE" || value === "DENOMINATOR_VALUE" || value === "WEIGHT") {
    return value;
  }
  return "VALUE";
}

function makeTaskKey(projectName: string, taskName: string): string {
  return `${projectName}\u0000${taskName}`;
}

async function importProjects(): Promise<Map<string, number>> {
  const rows = await readCsv("projects.csv");
  const projectIds = new Map<string, number>();

  for (const row of rows) {
    const sourceProjectId = required(row, "project_id", "projects.csv");
    const name = required(row, "project_name", "projects.csv");
    const values = {
      sourceProjectId,
      name,
      description: nullableText(row.description),
      startYear: integerOrNull(row.start_year) ?? defaultYears.startYear,
      endYear: integerOrNull(row.end_year) ?? defaultYears.endYear,
      status: nullableText(row.status) ?? "active",
      updatedAt: new Date(),
    };

    const [project] = await db.insert(projectsTable)
      .values(values)
      .onConflictDoUpdate({
        target: projectsTable.sourceProjectId,
        set: values,
      })
      .returning({ id: projectsTable.id });

    projectIds.set(sourceProjectId, project.id);
  }

  return projectIds;
}

async function importTasks(projectIds: Map<string, number>): Promise<Map<string, number>> {
  const rows = await readCsv("tasks.csv");
  const taskIds = new Map<string, number>();

  for (const row of rows) {
    const sourceTaskId = required(row, "task_id", "tasks.csv");
    const sourceProjectId = required(row, "project_id", "tasks.csv");
    const projectId = projectIds.get(sourceProjectId);
    if (!projectId) {
      throw new Error(`tasks.csv: unknown project_id ${sourceProjectId}`);
    }

    const values = {
      sourceTaskId,
      sourceProjectId,
      projectId,
      name: required(row, "task_name", "tasks.csv"),
      description: nullableText(row.description),
      managerName: nullableText(row.manager_name ?? row.owner),
      status: nullableText(row.status) ?? "active",
      updatedAt: new Date(),
    };

    const [task] = await db.insert(tasksTable)
      .values(values)
      .onConflictDoUpdate({
        target: tasksTable.sourceTaskId,
        set: values,
      })
      .returning({ id: tasksTable.id });

    taskIds.set(sourceTaskId, task.id);
  }

  return taskIds;
}

async function importIndicators(taskIds: Map<string, number>): Promise<Map<string, number>> {
  const taskRows = await readCsv("tasks.csv");
  const taskByName = new Map<string, number>();
  for (const row of taskRows) {
    const taskId = taskIds.get(required(row, "task_id", "tasks.csv"));
    if (taskId) {
      taskByName.set(makeTaskKey(row.project_name, row.task_name), taskId);
    }
  }

  const rows = await readCsv("indicators.csv");
  const indicatorIds = new Map<string, number>();

  for (const row of rows) {
    const sourceIndicatorId = required(row, "indicator_id", "indicators.csv");
    const taskId = taskByName.get(makeTaskKey(required(row, "project_name", "indicators.csv"), required(row, "task_name", "indicators.csv")));
    if (!taskId) {
      throw new Error(`indicators.csv: unknown task ${row.project_name} / ${row.task_name}`);
    }

    const level = indicatorLevel(row);
    const values = {
      sourceIndicatorId,
      sourceParentIndicatorId: nullableText(row.parent_indicator_id),
      taskId,
      parentId: null,
      indicatorType: level === "PARENT" ? "parent" : "child",
      indicatorScope: indicatorScope(row.indicator_scope),
      sourceScopeName: nullableText(row.source_scope_name),
      isRegionalAggregate: booleanValue(row.is_regional_aggregate),
      indicatorLevel: level,
      calculationMode: calculationMode(row),
      formulaType: nullableText(row.formula_type_from_2025_l ?? row.formula_type),
      sourceLevelConfidence: nullableText(row.source_level_confidence) ?? "EXPLICIT",
      sourceExcelRow: integerOrNull(row.source_excel_row),
      normalizedIndicatorName: nullableText(row.normalized_indicator_name),
      reviewRequired: reviewRequired(row),
      name: required(row, "indicator_name", "indicators.csv"),
      unit: nullableText(row.unit),
      formula: nullableText(row.source_2025_l_formula),
      weight: numberOrNull(row.source_weight),
      description: nullableText(row.note ?? row.review_note),
      updatedAt: new Date(),
    };

    const [indicator] = await db.insert(indicatorsTable)
      .values(values)
      .onConflictDoUpdate({
        target: indicatorsTable.sourceIndicatorId,
        set: values,
      })
      .returning({ id: indicatorsTable.id });

    indicatorIds.set(sourceIndicatorId, indicator.id);
  }

  for (const row of rows) {
    const sourceIndicatorId = required(row, "indicator_id", "indicators.csv");
    const sourceParentIndicatorId = nullableText(row.parent_indicator_id);
    if (!sourceParentIndicatorId) {
      continue;
    }

    const indicatorId = indicatorIds.get(sourceIndicatorId);
    const parentId = indicatorIds.get(sourceParentIndicatorId);
    if (!indicatorId || !parentId) {
      throw new Error(`indicators.csv: unknown parent link ${sourceParentIndicatorId} -> ${sourceIndicatorId}`);
    }

    await db.update(indicatorsTable)
      .set({ parentId, updatedAt: new Date() })
      .where(eq(indicatorsTable.id, indicatorId));
  }

  return indicatorIds;
}

async function importComponents(indicatorIds: Map<string, number>): Promise<void> {
  const rows = await readCsv("indicator_components.csv");

  for (const row of rows) {
    const sourceParentId = required(row, "parent_indicator_id", "indicator_components.csv");
    const sourceComponentId = required(row, "component_indicator_id", "indicator_components.csv");
    const parentIndicatorId = indicatorIds.get(sourceParentId);
    const componentIndicatorId = indicatorIds.get(sourceComponentId);
    if (!parentIndicatorId || !componentIndicatorId) {
      throw new Error(`indicator_components.csv: unknown component link ${sourceParentId} -> ${sourceComponentId}`);
    }

    const values = {
      parentIndicatorId,
      componentIndicatorId,
      componentRole: componentRole(row.component_role),
      weight: numberOrNull(row.weight_value_2025),
      sortOrder: integerOrNull(row.component_order) ?? 0,
      sourceFormula: nullableText(row.source_formula_2025_l),
      sourceFormulaCell: nullableText(row.weight_cell_2025),
      sourceExcelSheet: nullableText(row.source_sheet ?? "2025_L"),
      sourceExcelRow: integerOrNull(row.component_source_excel_row),
      reviewRequired: reviewRequired(row),
      updatedAt: new Date(),
    };

    await db.insert(indicatorComponentsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [indicatorComponentsTable.parentIndicatorId, indicatorComponentsTable.componentIndicatorId],
        set: values,
      });

    await db.update(indicatorsTable)
      .set({ calculationMode: "AUTO_FROM_CHILDREN", indicatorLevel: "PARENT", indicatorType: "parent", updatedAt: new Date() })
      .where(eq(indicatorsTable.id, parentIndicatorId));
  }
}

async function importFormulaLinks(indicatorIds: Map<string, number>): Promise<void> {
  const rows = await readCsv("formula_links_2025_l.csv");

  for (const row of rows) {
    const sourceParentId = required(row, "parent_indicator_id", "formula_links_2025_l.csv");
    const parentId = indicatorIds.get(sourceParentId);
    if (!parentId) {
      continue;
    }

    await db.update(indicatorsTable)
      .set({
        formula: nullableText(row.formula_2025_l),
        formulaType: nullableText(row.formula_type),
        sourceExcelRow: integerOrNull(row.parent_source_excel_row),
        reviewRequired: reviewRequired(row),
        updatedAt: new Date(),
      })
      .where(eq(indicatorsTable.id, parentId));
  }
}

async function importTargets(indicatorIds: Map<string, number>): Promise<void> {
  const rows = await readCsv("indicator_targets.csv");

  for (const row of rows) {
    const sourceIndicatorId = required(row, "indicator_id", "indicator_targets.csv");
    const indicatorId = indicatorIds.get(sourceIndicatorId);
    const year = integerOrNull(row.year);
    if (!indicatorId || !year) {
      throw new Error(`indicator_targets.csv: unknown indicator/year ${sourceIndicatorId} / ${row.year}`);
    }

    if (year < 2025 || year > 2029) {
      continue;
    }

    const values = {
      indicatorId,
      year,
      targetValue: numberOrNull(row.target_value),
      note: nullableText(`source_sheet=${row.source_sheet}; source_excel_row=${row.source_excel_row}`),
      updatedAt: new Date(),
    };

    await db.insert(indicatorTargetsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [indicatorTargetsTable.indicatorId, indicatorTargetsTable.year],
        set: values,
      });
  }
}

async function importActuals(indicatorIds: Map<string, number>): Promise<void> {
  const rows = await readCsv("indicator_actuals.csv");

  for (const row of rows) {
    const sourceIndicatorId = required(row, "indicator_id", "indicator_actuals.csv");
    const indicatorId = indicatorIds.get(sourceIndicatorId);
    const year = integerOrNull(row.year);
    if (!indicatorId || !year) {
      throw new Error(`indicator_actuals.csv: unknown indicator/year ${sourceIndicatorId} / ${row.year}`);
    }

    const values = {
      indicatorId,
      year,
      calculatedValue: numberOrNull(row.actual_value),
      progressRate: numberOrNull(row.achievement_rate),
      valueSource: "IMPORTED" as const,
      note: nullableText(`source=${row.value_source}; source_sheet=${row.source_sheet}; source_excel_row=${row.source_excel_row}`),
      status: "submitted",
      updatedAt: new Date(),
    };

    await db.insert(indicatorResultsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [indicatorResultsTable.indicatorId, indicatorResultsTable.year],
        set: values,
      });
  }
}

async function main(): Promise<void> {
  const projectIds = await importProjects();
  const taskIds = await importTasks(projectIds);
  const indicatorIds = await importIndicators(taskIds);
  await importComponents(indicatorIds);
  await importFormulaLinks(indicatorIds);
  await importTargets(indicatorIds);
  await importActuals(indicatorIds);

  console.log(`Imported ${projectIds.size} projects, ${taskIds.size} tasks, ${indicatorIds.size} indicators.`);
}

try {
  await main();
} finally {
  await pool.end();
}
