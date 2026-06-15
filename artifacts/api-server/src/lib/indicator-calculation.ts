import { and, eq, sql } from "drizzle-orm";
import {
  db,
  indicatorResultsTable,
  indicatorTargetsTable,
  indicatorsTable,
  type Indicator,
  type IndicatorResult,
} from "@workspace/db";

export const monthlyKeys = [
  "marValue",
  "aprValue",
  "mayValue",
  "junValue",
  "julValue",
  "augValue",
  "sepValue",
  "octValue",
  "novValue",
  "decValue",
  "janValue",
  "febValue",
] as const;

export type MonthlyKey = (typeof monthlyKeys)[number];
export type MonthlyValues = Partial<Record<MonthlyKey, number | null | undefined>>;

export interface CalculationChild {
  id?: number;
  weight?: number | null;
  value: number | null | undefined;
}

export function safeNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
}

export function sumMonthlyValues(values: MonthlyValues): number | null {
  let total = 0;
  let hasValue = false;
  for (const key of monthlyKeys) {
    const value = safeNumber(values[key]);
    if (value == null) continue;
    total += value;
    hasValue = true;
  }
  return hasValue ? total : null;
}

export function calculateProgress(actualTotal: number | null, targetValue: number | null): number | null {
  if (actualTotal == null || targetValue == null || targetValue === 0) return null;
  const value = Math.round((actualTotal / targetValue) * 1000) / 10;
  return Number.isFinite(value) ? value : null;
}

function sanitizeResult(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function childValues(children: CalculationChild[]): number[] | null {
  const values = children.map((child) => safeNumber(child.value));
  if (values.some((value) => value == null)) return null;
  return values as number[];
}

function weightedSum(children: CalculationChild[]): number | null {
  const values = childValues(children);
  if (!values) return null;
  if (!children.some((child) => child.weight != null)) return null;

  let total = 0;
  for (const [index, value] of values.entries()) {
    const weight = safeNumber(children[index]?.weight);
    if (weight == null) return null;
    total += value * weight;
  }
  return sanitizeResult(total);
}

export function evaluateIndicatorFormula(formula: string | null | undefined, children: CalculationChild[]): number | null {
  if (!children.length) return null;

  const values = childValues(children);
  const trimmed = formula?.trim();

  if (!trimmed) {
    const weighted = weightedSum(children);
    if (weighted != null) return weighted;
    return values ? sanitizeResult(values.reduce((total, value) => total + value, 0)) : null;
  }

  if (!values) return null;

  const sum = values.reduce((total, value) => total + value, 0);
  const avg = sum / values.length;
  const variables = Object.fromEntries(values.map((value, index) => [`child_${index + 1}`, value]));
  const expression = trimmed
    .replace(/\bsum\(children\)/gi, String(sum))
    .replace(/\bavg\(children\)/gi, String(avg));

  if (!/^[\d\s+\-*/()._a-zA-Z]+$/.test(expression)) return null;

  try {
    const result = Number(Function(...Object.keys(variables), `"use strict"; return (${expression});`)(...Object.values(variables)));
    return sanitizeResult(result);
  } catch {
    return null;
  }
}

export function mergeMonthlyValues(
  existing: MonthlyValues,
  patch: MonthlyValues,
): Record<MonthlyKey, number | null | undefined> {
  return Object.fromEntries(
    monthlyKeys.map((key) => [key, patch[key] === undefined ? existing[key] : patch[key]]),
  ) as Record<MonthlyKey, number | null | undefined>;
}

export async function getTargetValue(indicatorId: number, year: number): Promise<number | null> {
  const [target] = await db
    .select()
    .from(indicatorTargetsTable)
    .where(and(eq(indicatorTargetsTable.indicatorId, indicatorId), eq(indicatorTargetsTable.year, year)));
  return safeNumber(target?.targetValue);
}

async function calculateParentTarget(parent: Indicator, children: Indicator[], year: number): Promise<number | null> {
  const directTarget = await getTargetValue(parent.id, year);
  if (directTarget != null) return directTarget;

  const childTargets = await Promise.all(
    children.map(async (child) => ({ value: await getTargetValue(child.id, year), weight: child.weight })),
  );
  return evaluateIndicatorFormula(parent.formula, childTargets);
}

export async function getIndicatorEntryMode(indicatorId: number): Promise<{
  indicator: Indicator | undefined;
  children: Indicator[];
  canDirectInput: boolean;
}> {
  const [indicator] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, indicatorId));
  if (!indicator) return { indicator, children: [], canDirectInput: false };
  const children = await db.select().from(indicatorsTable).where(eq(indicatorsTable.parentId, indicatorId));
  return {
    indicator,
    children,
    canDirectInput: indicator.indicatorType === "child" || children.length === 0,
  };
}

export async function recalculateParentResult(parentIndicatorId: number, year: number): Promise<IndicatorResult | null> {
  const [parent] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, parentIndicatorId));
  if (!parent) return null;

  const children = await db.select().from(indicatorsTable).where(eq(indicatorsTable.parentId, parentIndicatorId));
  if (children.length === 0) return null;

  const childResults = await Promise.all(
    children.map(async (child) => {
      const [result] = await db
        .select()
        .from(indicatorResultsTable)
        .where(and(eq(indicatorResultsTable.indicatorId, child.id), eq(indicatorResultsTable.year, year)));
      return { child, result };
    }),
  );

  const calculatedMonthlyValues = Object.fromEntries(
    monthlyKeys.map((key) => {
      const childrenForMonth = childResults.map(({ child, result }) => ({
        value: result?.[key],
        weight: child.weight,
      }));
      return [key, evaluateIndicatorFormula(parent.formula, childrenForMonth)];
    }),
  ) as Record<MonthlyKey, number | null>;

  const calculatedValue = sumMonthlyValues(calculatedMonthlyValues);
  const targetValue = await calculateParentTarget(parent, children, year);
  const progressRate = calculateProgress(calculatedValue, targetValue);

  const [result] = await db
    .insert(indicatorResultsTable)
    .values({
      indicatorId: parentIndicatorId,
      year,
      ...calculatedMonthlyValues,
      calculatedValue,
      progressRate,
      status: "draft",
      note: "하위지표 기준 자동산출",
    })
    .onConflictDoUpdate({
      target: [indicatorResultsTable.indicatorId, indicatorResultsTable.year],
      set: {
        marValue: sql`excluded.mar_value`,
        aprValue: sql`excluded.apr_value`,
        mayValue: sql`excluded.may_value`,
        junValue: sql`excluded.jun_value`,
        julValue: sql`excluded.jul_value`,
        augValue: sql`excluded.aug_value`,
        sepValue: sql`excluded.sep_value`,
        octValue: sql`excluded.oct_value`,
        novValue: sql`excluded.nov_value`,
        decValue: sql`excluded.dec_value`,
        janValue: sql`excluded.jan_value`,
        febValue: sql`excluded.feb_value`,
        calculatedValue,
        progressRate,
        status: "draft",
        note: "하위지표 기준 자동산출",
        updatedAt: new Date(),
      },
    })
    .returning();

  return result;
}
