import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, indicatorsTable } from "@workspace/db";
import {
  CreateIndicatorBody,
  UpdateIndicatorBody,
  GetIndicatorParams,
  UpdateIndicatorParams,
  DeleteIndicatorParams,
  ListIndicatorsQueryParams,
  ListIndicatorsResponse,
  GetIndicatorResponse,
  UpdateIndicatorResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

router.get("/indicators", async (req, res): Promise<void> => {
  const query = ListIndicatorsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  let q = db.select().from(indicatorsTable).$dynamic();
  const conditions = [];
  if (query.data.taskId) {
    conditions.push(eq(indicatorsTable.taskId, query.data.taskId));
  }
  if (query.data.indicatorType) {
    conditions.push(eq(indicatorsTable.indicatorType, query.data.indicatorType));
  }
  if (query.data.parentId !== undefined) {
    if (query.data.parentId === null) {
      conditions.push(isNull(indicatorsTable.parentId));
    } else {
      conditions.push(eq(indicatorsTable.parentId, query.data.parentId));
    }
  }
  if (conditions.length > 0) {
    q = q.where(and(...conditions));
  }
  const indicators = await q.orderBy(indicatorsTable.createdAt);
  res.json(ListIndicatorsResponse.parse(serialize(indicators)));
});

router.post("/indicators", async (req, res): Promise<void> => {
  const parsed = CreateIndicatorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [indicator] = await db.insert(indicatorsTable).values(parsed.data).returning();
  res.status(201).json(GetIndicatorResponse.parse(serialize(indicator)));
});

router.get("/indicators/:id", async (req, res): Promise<void> => {
  const params = GetIndicatorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [indicator] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, params.data.id));
  if (!indicator) {
    res.status(404).json({ error: "지표를 찾을 수 없습니다." });
    return;
  }
  res.json(GetIndicatorResponse.parse(serialize(indicator)));
});

router.patch("/indicators/:id", async (req, res): Promise<void> => {
  const params = UpdateIndicatorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateIndicatorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [indicator] = await db
    .update(indicatorsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(indicatorsTable.id, params.data.id))
    .returning();
  if (!indicator) {
    res.status(404).json({ error: "지표를 찾을 수 없습니다." });
    return;
  }
  res.json(UpdateIndicatorResponse.parse(serialize(indicator)));
});

router.delete("/indicators/:id", async (req, res): Promise<void> => {
  const params = DeleteIndicatorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [indicator] = await db.delete(indicatorsTable).where(eq(indicatorsTable.id, params.data.id)).returning();
  if (!indicator) {
    res.status(404).json({ error: "지표를 찾을 수 없습니다." });
    return;
  }
  res.sendStatus(204);
});

export default router;
