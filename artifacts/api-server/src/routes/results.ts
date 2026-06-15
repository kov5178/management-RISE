import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, indicatorResultsTable, indicatorsTable } from "@workspace/db";
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
import {
  calculateProgress,
  getIndicatorEntryMode,
  getTargetValue,
  mergeMonthlyValues,
  monthlyKeys,
  recalculateParentResult,
  sumMonthlyValues,
  type MonthlyKey,
} from "../lib/indicator-calculation.js";

const router: IRouter = Router();

async function recalculateParentIfNeeded(indicatorId: number, year: number): Promise<void> {
  const [indicator] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, indicatorId));
  if (indicator?.parentId) {
    await recalculateParentResult(indicator.parentId, year);
  }
}

async function assertCanSaveResult(indicatorId: number): Promise<void> {
  const { indicator, children, canDirectInput } = await getIndicatorEntryMode(indicatorId);
  if (!indicator) {
    throw new Error("지표를 찾을 수 없습니다.");
  }
  if (!canDirectInput && indicator.indicatorType === "parent" && children.length > 0) {
    throw new Error("하위지표가 있는 상위지표는 자동산출 대상이므로 직접 입력할 수 없습니다.");
  }
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

  try {
    await assertCanSaveResult(parsed.data.indicatorId);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "실적을 저장할 수 없습니다." });
    return;
  }

  const calculatedValue = sumMonthlyValues(parsed.data);
  const targetValue = await getTargetValue(parsed.data.indicatorId, parsed.data.year);
  const progressRate = calculateProgress(calculatedValue, targetValue);

  const [result] = await db
    .insert(indicatorResultsTable)
    .values({ ...parsed.data, calculatedValue, progressRate })
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
        note: sql`excluded.note`,
        status: sql`excluded.status`,
        calculatedValue,
        progressRate,
        updatedAt: new Date(),
      },
    })
    .returning();

  await recalculateParentIfNeeded(parsed.data.indicatorId, parsed.data.year);

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

  try {
    await assertCanSaveResult(existing.indicatorId);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "실적을 저장할 수 없습니다." });
    return;
  }

  const mergedValues = mergeMonthlyValues(
    Object.fromEntries(monthlyKeys.map((key) => [key, existing[key]])) as Record<MonthlyKey, number | null | undefined>,
    parsed.data,
  );
  const year = parsed.data.year ?? existing.year;
  const calculatedValue = sumMonthlyValues(mergedValues);
  const targetValue = await getTargetValue(existing.indicatorId, year);
  const progressRate = calculateProgress(calculatedValue, targetValue);

  const [result] = await db
    .update(indicatorResultsTable)
    .set({ ...parsed.data, calculatedValue, progressRate, updatedAt: new Date() })
    .where(eq(indicatorResultsTable.id, params.data.id))
    .returning();

  await recalculateParentIfNeeded(existing.indicatorId, existing.year);
  if (year !== existing.year) {
    await recalculateParentIfNeeded(existing.indicatorId, year);
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

  await recalculateParentIfNeeded(result.indicatorId, result.year);

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
