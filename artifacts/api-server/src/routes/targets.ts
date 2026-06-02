import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, indicatorTargetsTable, indicatorsTable } from "@workspace/db";
import {
  CreateTargetBody,
  UpdateTargetBody,
  UpdateTargetParams,
  DeleteTargetParams,
  ListTargetsQueryParams,
  ListTargetsResponse,
  UpdateTargetResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

router.get("/targets", async (req, res): Promise<void> => {
  const query = ListTargetsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  let q = db.select().from(indicatorTargetsTable).$dynamic();
  const conditions = [];
  if (query.data.indicatorId) {
    conditions.push(eq(indicatorTargetsTable.indicatorId, query.data.indicatorId));
  }
  if (query.data.year) {
    conditions.push(eq(indicatorTargetsTable.year, query.data.year));
  }
  if (conditions.length > 0) {
    q = q.where(and(...conditions));
  }
  const targets = await q.orderBy(indicatorTargetsTable.year);
  res.json(ListTargetsResponse.parse(serialize(targets)));
});

router.post("/targets", async (req, res): Promise<void> => {
  const parsed = CreateTargetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [indicator] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, parsed.data.indicatorId));
  if (!indicator || indicator.indicatorType !== "child") {
    res.status(400).json({ error: "하위지표에 대해서만 목표값을 직접 입력할 수 있습니다." });
    return;
  }
  const [target] = await db.insert(indicatorTargetsTable).values(parsed.data).returning();
  res.status(201).json(serialize(target));
});

router.patch("/targets/:id", async (req, res): Promise<void> => {
  const params = UpdateTargetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTargetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [target] = await db
    .update(indicatorTargetsTable)
    .set(parsed.data)
    .where(eq(indicatorTargetsTable.id, params.data.id))
    .returning();
  if (!target) {
    res.status(404).json({ error: "목표값을 찾을 수 없습니다." });
    return;
  }
  res.json(UpdateTargetResponse.parse(serialize(target)));
});

router.delete("/targets/:id", async (req, res): Promise<void> => {
  const params = DeleteTargetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [target] = await db.delete(indicatorTargetsTable).where(eq(indicatorTargetsTable.id, params.data.id)).returning();
  if (!target) {
    res.status(404).json({ error: "목표값을 찾을 수 없습니다." });
    return;
  }
  res.sendStatus(204);
});

export default router;
