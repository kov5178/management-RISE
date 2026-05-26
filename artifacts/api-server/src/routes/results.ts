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

function calculateProgress(actualValue: number | null, targetValue: number | null): number | null {
  if (actualValue == null || targetValue == null || targetValue === 0) return null;
  return Math.round((actualValue / targetValue) * 1000) / 10;
}

router.get("/results", async (req, res): Promise<void> => {
  const query = ListResultsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  let q = db.select().from(indicatorResultsTable).$dynamic();
  const conditions = [];
  if (query.data.indicatorId) {
    conditions.push(eq(indicatorResultsTable.indicatorId, query.data.indicatorId));
  }
  if (query.data.year) {
    conditions.push(eq(indicatorResultsTable.year, query.data.year));
  }
  if (query.data.status) {
    conditions.push(eq(indicatorResultsTable.status, query.data.status));
  }
  if (conditions.length > 0) {
    q = q.where(and(...conditions));
  }
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
    res.status(400).json({ error: "하위지표를 선택한 후 세부프로그램 실적을 입력할 수 있습니다." });
    return;
  }

  let [target] = await db
    .select()
    .from(indicatorTargetsTable)
    .where(
      and(
        eq(indicatorTargetsTable.indicatorId, parsed.data.indicatorId),
        eq(indicatorTargetsTable.year, parsed.data.year)
      )
    );
  const progressRate = calculateProgress(parsed.data.actualValue ?? null, target?.targetValue ?? null);

  const [result] = await db
    .insert(indicatorResultsTable)
    .values({ ...parsed.data, progressRate })
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

  let progressRate: number | null | undefined = undefined;
  if (parsed.data.actualValue !== undefined || parsed.data.year !== undefined) {
    const [existing] = await db.select().from(indicatorResultsTable).where(eq(indicatorResultsTable.id, params.data.id));
    if (existing) {
      const year = parsed.data.year ?? existing.year;
      let [target] = await db
        .select()
        .from(indicatorTargetsTable)
        .where(
          and(
            eq(indicatorTargetsTable.indicatorId, existing.indicatorId),
            eq(indicatorTargetsTable.year, year)
          )
        );
      const actualValue = parsed.data.actualValue === undefined ? existing.actualValue : parsed.data.actualValue;
      progressRate = calculateProgress(actualValue ?? null, target?.targetValue ?? null);
    }
  }

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (progressRate !== undefined) updateData.progressRate = progressRate;

  const [result] = await db
    .update(indicatorResultsTable)
    .set(updateData)
    .where(eq(indicatorResultsTable.id, params.data.id))
    .returning();
  if (!result) {
    res.status(404).json({ error: "실적을 찾을 수 없습니다." });
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
