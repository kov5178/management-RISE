import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, indicatorResultsTable, indicatorTargetsTable, indicatorsTable } from "@workspace/db";
import {
  CreateResultBody,
  UpdateResultBody,
  GetResultParams,
  UpdateResultParams,
  DeleteResultParams,
  SubmitResultParams,
  ListResultsQueryParams,
  ListResultsResponse,
  GetResultResponse,
  UpdateResultResponse,
  SubmitResultResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();
const AUTO_FROM_CHILDREN = "AUTO_FROM_CHILDREN";
const DIRECT_INPUT = "DIRECT_INPUT";
const MANUAL = "MANUAL";
const CALCULATED = "CALCULATED";

const monthlyKeys = [
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

type MonthlyKey = (typeof monthlyKeys)[number];
type MonthlyValueMap = Record<MonthlyKey, number | null>;
type IndicatorRow = typeof indicatorsTable.$inferSelect;
type ResultRow = typeof indicatorResultsTable.$inferSelect;

function hasAnyMonthlyValue(values: Partial<Record<MonthlyKey, number | null | undefined>>): boolean {
  return monthlyKeys.some((key) => values[key] !== null && values[key] !== undefined);
}

function sumMonthlyValues(values: Partial<Record<MonthlyKey, number | null | undefined>>): number | null {
  if (!hasAnyMonthlyValue(values)) return null;
  return monthlyKeys.reduce((total, key) => total + Number(values[key] ?? 0), 0);
}

function calculateProgress(actualTotal: number | null, targetValue: number | null): number | null {
  if (actualTotal == null || targetValue == null || targetValue === 0) return null;
  const progress = Math.round((actualTotal / targetValue) * 1000) / 10;
  return Number.isFinite(progress) ? progress : null;
}

async function getTargetValue(indicatorId: number, year: number): Promise<number | null> {
  const [target] = await db
    .select()
    .from(indicatorTargetsTable)
    .where(and(eq(indicatorTargetsTable.indicatorId, indicatorId), eq(indicatorTargetsTable.year, year)));
  return target?.targetValue ?? null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAlias(value: string) {
  return value.trim().replace(/[^0-9a-zA-Z가-힣_]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeWeight(weight: number | null | undefined): number | null {
  if (weight == null) return null;
  return weight > 1 ? weight / 100 : weight;
}

function validateWeightSum(children: IndicatorRow[]): string | null {
  if (children.length === 0) return null;
  const weights = children.map((child) => child.weight);
  if (weights.some((weight) => weight == null)) {
    return "자동산출형 상위지표의 모든 하위지표에 가중치를 입력해야 합니다.";
  }
  const rawSum = weights.reduce((sum, weight) => sum + Number(weight ?? 0), 0);
  const normalizedSum = weights.reduce((sum, weight) => sum + Number(normalizeWeight(weight) ?? 0), 0);
  const valid = Math.abs(rawSum - 1) < 0.0001 || Math.abs(rawSum - 100) < 0.0001 || Math.abs(normalizedSum - 1) < 0.0001;
  return valid ? null : "자동산출형 상위지표의 하위지표 가중치 합계는 1 또는 100이어야 합니다.";
}

function evaluateFormula(
  formula: string | null | undefined,
  children: Array<{ indicator: IndicatorRow; value: number | null }>,
): number | null {
  if (!children.length) return null;
  if (children.some((child) => child.value == null)) return null;

  const numericChildren = children.map((child) => ({ indicator: child.indicator, value: Number(child.value) }));
  if (!formula?.trim()) {
    return numericChildren.reduce((total, child) => total + child.value * Number(normalizeWeight(child.indicator.weight) ?? 0), 0);
  }

  const vars: Record<string, number> = {};
  numericChildren.forEach((child, index) => {
    const letterAlias = String.fromCharCode(65 + index);
    vars[`child_${index + 1}`] = child.value;
    vars[letterAlias] = child.value;
    const normalizedName = normalizeAlias(child.indicator.name);
    if (normalizedName) vars[normalizedName] = child.value;
  });

  let expression = formula.trim();
  [...numericChildren].sort((a, b) => b.indicator.name.length - a.indicator.name.length).forEach((child) => {
    expression = expression.replace(new RegExp(`\\[${escapeRegExp(child.indicator.name)}\\]`, "g"), String(child.value));
    expression = expression.replace(new RegExp(escapeRegExp(child.indicator.name), "g"), String(child.value));
  });

  expression = expression
    .replace(/\bsum\(children\)/gi, String(numericChildren.reduce((total, child) => total + child.value, 0)))
    .replace(/\bavg\(children\)/gi, String(numericChildren.reduce((total, child) => total + child.value, 0) / numericChildren.length))
    .replace(/\bavg\(([^)]+)\)/gi, (_, inner: string) => {
      const values = inner.split(",").map((key) => Number(vars[key.trim()] ?? 0));
      return String(values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1));
    });

  if (!/^[\d\s+\-*/()._a-zA-Z]+$/.test(expression)) return null;

  try {
    const result = Number(Function(...Object.keys(vars), `"use strict"; return (${expression});`)(...Object.values(vars)));
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function valuesFromResult(result: ResultRow | undefined): MonthlyValueMap {
  return Object.fromEntries(monthlyKeys.map((key) => [key, result?.[key] ?? null])) as MonthlyValueMap;
}

async function recalculateParentResult(parentId: number | null | undefined, year: number): Promise<string | null> {
  if (parentId == null) return null;
  const [parent] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, parentId));
  if (!parent) return null;

  const children = await db.select().from(indicatorsTable).where(eq(indicatorsTable.parentId, parentId));
  if (children.length === 0) {
    await db.update(indicatorsTable).set({ calculationMode: DIRECT_INPUT, updatedAt: new Date() }).where(eq(indicatorsTable.id, parentId));
    return null;
  }
  await db.update(indicatorsTable).set({ calculationMode: AUTO_FROM_CHILDREN, updatedAt: new Date() }).where(eq(indicatorsTable.id, parentId));

  const weightError = validateWeightSum(children);
  if (weightError) return weightError;

  const childResults = await db.select().from(indicatorResultsTable).where(eq(indicatorResultsTable.year, year));
  const resultByIndicator = new Map(childResults.map((result) => [result.indicatorId, result]));
  const calculatedMonthly = Object.fromEntries(monthlyKeys.map((key) => {
    const value = evaluateFormula(parent.formula, children.map((child) => ({ indicator: child, value: valuesFromResult(resultByIndicator.get(child.id))[key] })));
    return [key, value];
  })) as MonthlyValueMap;

  const calculatedValue = sumMonthlyValues(calculatedMonthly);
  const targetValue = await getTargetValue(parent.id, year);
  const progressRate = calculateProgress(calculatedValue, targetValue);

  const [result] = await db
    .insert(indicatorResultsTable)
    .values({
      indicatorId: parent.id,
      year,
      valueSource: CALCULATED,
      ...calculatedMonthly,
      calculatedValue,
      progressRate,
      status: "draft",
      note: "하위지표 실적 기준 자동산출",
    })
    .onConflictDoUpdate({
      target: [indicatorResultsTable.indicatorId, indicatorResultsTable.year],
      set: {
        valueSource: CALCULATED,
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
        note: "하위지표 실적 기준 자동산출",
        updatedAt: new Date(),
      },
    })
    .returning();

  return result ? null : "상위지표 자동산출 저장에 실패했습니다.";
}

async function validateResultTarget(indicatorId: number): Promise<{ indicator: IndicatorRow | null; children: IndicatorRow[]; error: string | null }> {
  const [indicator] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, indicatorId));
  if (!indicator) return { indicator: null, children: [], error: "지표를 찾을 수 없습니다." };
  const children = indicator.indicatorType === "parent"
    ? await db.select().from(indicatorsTable).where(eq(indicatorsTable.parentId, indicator.id))
    : [];

  if (indicator.indicatorType === "parent" && children.length > 0) {
    return { indicator, children, error: "하위지표가 있는 상위지표는 자동산출형이므로 직접 실적을 저장할 수 없습니다." };
  }
  if (indicator.calculationMode === AUTO_FROM_CHILDREN) {
    return { indicator, children, error: "자동산출형 상위지표는 직접 실적을 저장할 수 없습니다." };
  }
  if (indicator.calculationMode === DIRECT_INPUT && children.length > 0) {
    return { indicator, children, error: "하위지표가 있는 DIRECT_INPUT 지표에는 실적을 저장할 수 없습니다." };
  }
  return { indicator, children, error: null };
}

router.get("/results", async (req, res): Promise<void> => {
  const query = ListResultsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let q = db.select().from(indicatorResultsTable).$dynamic();
  const conditions = [];
  if (query.data.indicatorId) conditions.push(eq(indicatorResultsTable.indicatorId, query.data.indicatorId));
  if (query.data.year) conditions.push(eq(indicatorResultsTable.year, query.data.year));
  if (query.data.status) conditions.push(eq(indicatorResultsTable.status, query.data.status));
  if (conditions.length > 0) q = q.where(and(...conditions));

  const results = await q.orderBy(indicatorResultsTable.createdAt);
  res.json(ListResultsResponse.parse(serialize(results)));
});

router.post("/results", async (req, res): Promise<void> => {
  const parsed = CreateResultBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const validation = await validateResultTarget(parsed.data.indicatorId);
  if (validation.error || !validation.indicator) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const calculatedValue = sumMonthlyValues(parsed.data);
  const targetValue = await getTargetValue(parsed.data.indicatorId, parsed.data.year);
  const progressRate = calculateProgress(calculatedValue, targetValue);

  const [result] = await db
    .insert(indicatorResultsTable)
    .values({ ...parsed.data, valueSource: MANUAL, calculatedValue, progressRate })
    .onConflictDoUpdate({
      target: [indicatorResultsTable.indicatorId, indicatorResultsTable.year],
      set: {
        valueSource: MANUAL,
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
        note: sql`excluded.note`,
        status: sql`excluded.status`,
        calculatedValue,
        progressRate,
        updatedAt: new Date(),
      },
    })
    .returning();

  const parentError = await recalculateParentResult(validation.indicator.parentId, parsed.data.year);
  if (parentError) {
    res.status(400).json({ error: parentError });
    return;
  }
  res.status(201).json(GetResultResponse.parse(serialize(result)));
});

router.get("/results/:id", async (req, res): Promise<void> => {
  const params = GetResultParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [result] = await db.select().from(indicatorResultsTable).where(eq(indicatorResultsTable.id, params.data.id));
  if (!result) {
    res.status(404).json({ error: "실적을 찾을 수 없습니다." });
    return;
  }
  res.json(GetResultResponse.parse(serialize(result)));
});

router.patch("/results/:id", async (req, res): Promise<void> => {
  const params = UpdateResultParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateResultBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(indicatorResultsTable).where(eq(indicatorResultsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "실적을 찾을 수 없습니다." });
    return;
  }

  const validation = await validateResultTarget(existing.indicatorId);
  if (validation.error || !validation.indicator) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const mergedValues = Object.fromEntries(
    monthlyKeys.map((key) => [key, parsed.data[key] === undefined ? existing[key] : parsed.data[key]]),
  ) as Record<MonthlyKey, number | null | undefined>;
  const year = parsed.data.year ?? existing.year;
  const calculatedValue = sumMonthlyValues(mergedValues);
  const targetValue = await getTargetValue(existing.indicatorId, year);
  const progressRate = calculateProgress(calculatedValue, targetValue);

  const [result] = await db
    .update(indicatorResultsTable)
    .set({ ...parsed.data, valueSource: MANUAL, calculatedValue, progressRate, updatedAt: new Date() })
    .where(eq(indicatorResultsTable.id, params.data.id))
    .returning();

  const parentError = await recalculateParentResult(validation.indicator.parentId, year);
  if (parentError) {
    res.status(400).json({ error: parentError });
    return;
  }
  res.json(UpdateResultResponse.parse(serialize(result)));
});

router.delete("/results/:id", async (req, res): Promise<void> => {
  const params = DeleteResultParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [result] = await db.delete(indicatorResultsTable).where(eq(indicatorResultsTable.id, params.data.id)).returning();
  if (!result) {
    res.status(404).json({ error: "실적을 찾을 수 없습니다." });
    return;
  }
  const [indicator] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, result.indicatorId));
  await recalculateParentResult(indicator?.parentId, result.year);
  res.sendStatus(204);
});

router.post("/results/:id/submit", async (req, res): Promise<void> => {
  const params = SubmitResultParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [result] = await db
    .update(indicatorResultsTable)
    .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(indicatorResultsTable.id, params.data.id))
    .returning();
  if (!result) {
    res.status(404).json({ error: "실적을 찾을 수 없습니다." });
    return;
  }
  res.json(SubmitResultResponse.parse(serialize(result)));
});

export default router;
