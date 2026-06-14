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
type ResultValues = Partial<Record<MonthlyKey, number | null | undefined>>;

function sumMonthlyValues(values: ResultValues): number {
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

async function recalculateAutoParents(indicatorId: number, year: number): Promise<void> {
  let [current] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, indicatorId));

  while (current?.parentId != null) {
    const [parent] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, current.parentId));
    if (!parent) return;

    if (parent.calculationMode !== "AUTO_FROM_CHILDREN") {
      current = parent;
      continue;
    }

    const children = await db.select().from(indicatorsTable).where(eq(indicatorsTable.parentId, parent.id));
    const childResults = [];
    for (const child of children) {
      const [result] = await db
        .select()
        .from(indicatorResultsTable)
        .where(and(eq(indicatorResultsTable.indicatorId, child.id), eq(indicatorResultsTable.year, year)));
      if (result) childResults.push(result);
    }

    if (childResults.length === 0) {
      current = parent;
      continue;
    }

    const monthlyValues = Object.fromEntries(
      monthlyKeys.map((key) => [key, childResults.reduce((sum, result) => sum + Number(result[key] ?? 0), 0)]),
    ) as Record<MonthlyKey, number>;
    const calculatedValue = childResults.reduce((sum, result) => sum + Number(result.calculatedValue ?? 0), 0);
    const targetValue = await getTargetValue(parent.id, year);
    const progressRate = calculateProgress(calculatedValue, targetValue);
    const status = childResults.every((result) => result.status === "submitted") ? "submitted" : "draft";

    await db
      .insert(indicatorResultsTable)
      .values({
        indicatorId: parent.id,
        year,
        ...monthlyValues,
        note: "하위지표 실적 기반 자동산출",
        calculatedValue,
        progressRate,
        status,
      })
      .onConflictDoUpdate({
        target: [indicatorResultsTable.indicatorId, indicatorResultsTable.year],
        set: {
          marValue: monthlyValues.marValue,
          aprValue: monthlyValues.aprValue,
          mayValue: monthlyValues.mayValue,
          junValue: monthlyValues.junValue,
          julValue: monthlyValues.julValue,
          augValue: monthlyValues.augValue,
          sepValue: monthlyValues.sepValue,
          octValue: monthlyValues.octValue,
          novValue: monthlyValues.novValue,
          decValue: monthlyValues.decValue,
          janValue: monthlyValues.janValue,
          febValue: monthlyValues.febValue,
          note: "하위지표 실적 기반 자동산출",
          calculatedValue,
          progressRate,
          status,
          updatedAt: new Date(),
        },
      });

    current = parent;
  }
}

async function assertDirectInputIndicator(indicatorId: number): Promise<string | null> {
  const [indicator] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, indicatorId));
  if (!indicator) return "지표를 찾을 수 없습니다.";
  if (indicator.calculationMode === "AUTO_FROM_CHILDREN") {
    return "자동산출 지표는 하위지표 실적으로 계산되므로 직접 입력할 수 없습니다.";
  }
  return null;
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

  const inputError = await assertDirectInputIndicator(parsed.data.indicatorId);
  if (inputError) {
    res.status(400).json({ error: inputError });
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

  await recalculateAutoParents(parsed.data.indicatorId, parsed.data.year);
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

  const inputError = await assertDirectInputIndicator(existing.indicatorId);
  if (inputError) {
    res.status(400).json({ error: inputError });
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

  await recalculateAutoParents(existing.indicatorId, year);
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
