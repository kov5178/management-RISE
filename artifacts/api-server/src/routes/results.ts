import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
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

function sumMonthlyValues(values: Partial<Record<MonthlyKey, number | null | undefined>>): number {
  return monthlyKeys.reduce((total, key) => total + Number(values[key] ?? 0), 0);
}

function calculateProgress(actualTotal: number | null, targetValue: number | null): number | null {
  if (actualTotal == null || targetValue == null || targetValue === 0) return null;
  return Math.round((actualTotal / targetValue) * 1000) / 10;
}

async function getTargetValue(indicatorId: number, year: number): Promise<number | null> {
  const [target] = await db
    .select()
    .from(indicatorTargetsTable)
    .where(and(eq(indicatorTargetsTable.indicatorId, indicatorId), eq(indicatorTargetsTable.year, year)));
  return target?.targetValue ?? null;
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

  const [detailIndicator] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, parsed.data.indicatorId));
  if (!detailIndicator || detailIndicator.indicatorType !== "child") {
    res.status(400).json({ error: "하위지표에 대해서만 월별 실적을 입력할 수 있습니다." });
    return;
  }

  const calculatedValue = sumMonthlyValues(parsed.data);
  const targetValue = await getTargetValue(parsed.data.indicatorId, parsed.data.year);
  const progressRate = calculateProgress(calculatedValue, targetValue);

  const [result] = await db
    .insert(indicatorResultsTable)
    .values({ ...parsed.data, calculatedValue, progressRate })
    .returning();
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

  const mergedValues = Object.fromEntries(
    monthlyKeys.map((key) => [key, parsed.data[key] === undefined ? existing[key] : parsed.data[key]]),
  ) as Record<MonthlyKey, number | null | undefined>;
  const year = parsed.data.year ?? existing.year;
  const calculatedValue = sumMonthlyValues(mergedValues);
  const targetValue = await getTargetValue(existing.indicatorId, year);
  const progressRate = calculateProgress(calculatedValue, targetValue);

  const [result] = await db
    .update(indicatorResultsTable)
    .set({ ...parsed.data, calculatedValue, progressRate, updatedAt: new Date() })
    .where(eq(indicatorResultsTable.id, params.data.id))
    .returning();

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
