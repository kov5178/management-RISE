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

async function validateIndicatorParent(
  indicatorType: string,
  parentId: number | null | undefined,
  taskId: number,
): Promise<string | null> {
  if (indicatorType === "parent") {
    return parentId == null ? null : "지표에는 상위 항목을 지정할 수 없습니다.";
  }
  if (indicatorType !== "child") {
    return "지원하지 않는 지표 유형입니다.";
  }
  if (parentId == null) {
    return "세부지표의 상위 지표를 선택해주세요.";
  }
  const [parent] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, parentId));
  if (!parent || parent.indicatorType !== "parent" || parent.taskId !== taskId) {
    return "동일 과제의 지표 아래에만 세부지표를 등록할 수 있습니다.";
  }
  return null;
}

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
  const hierarchyError = await validateIndicatorParent(parsed.data.indicatorType, parsed.data.parentId, parsed.data.taskId);
  if (hierarchyError) {
    res.status(400).json({ error: hierarchyError });
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
  const [existing] = await db.select().from(indicatorsTable).where(eq(indicatorsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "지표를 찾을 수 없습니다." });
    return;
  }
  const hierarchyError = await validateIndicatorParent(
    parsed.data.indicatorType ?? existing.indicatorType,
    parsed.data.parentId === undefined ? existing.parentId : parsed.data.parentId,
    existing.taskId,
  );
  if (hierarchyError) {
    res.status(400).json({ error: hierarchyError });
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
