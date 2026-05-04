import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, feedbackActionsTable } from "@workspace/db";
import {
  CreateFeedbackBody,
  UpdateFeedbackBody,
  UpdateFeedbackParams,
  ListFeedbackQueryParams,
  ListFeedbackResponse,
  UpdateFeedbackResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

router.get("/feedback", async (req, res): Promise<void> => {
  const query = ListFeedbackQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  let q = db.select().from(feedbackActionsTable).$dynamic();
  const conditions = [];
  if (query.data.taskId) {
    conditions.push(eq(feedbackActionsTable.taskId, query.data.taskId));
  }
  if (query.data.year) {
    conditions.push(eq(feedbackActionsTable.year, query.data.year));
  }
  if (conditions.length > 0) {
    q = q.where(and(...conditions));
  }
  const feedback = await q.orderBy(feedbackActionsTable.createdAt);
  res.json(ListFeedbackResponse.parse(serialize(feedback)));
});

router.post("/feedback", async (req, res): Promise<void> => {
  const parsed = CreateFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [fb] = await db.insert(feedbackActionsTable).values(parsed.data).returning();
  res.status(201).json(serialize(fb));
});

router.patch("/feedback/:id", async (req, res): Promise<void> => {
  const params = UpdateFeedbackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [fb] = await db
    .update(feedbackActionsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(feedbackActionsTable.id, params.data.id))
    .returning();
  if (!fb) {
    res.status(404).json({ error: "자체평가/환류를 찾을 수 없습니다." });
    return;
  }
  res.json(UpdateFeedbackResponse.parse(serialize(fb)));
});

export default router;
