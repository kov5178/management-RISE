import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, reviewsTable, indicatorResultsTable } from "@workspace/db";
import {
  CreateReviewBody,
  ListReviewsQueryParams,
  ListReviewsResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

router.get("/reviews", async (req, res): Promise<void> => {
  const query = ListReviewsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  let q = db.select().from(reviewsTable).$dynamic();
  if (query.data.resultId) {
    q = q.where(eq(reviewsTable.resultId, query.data.resultId));
  }
  const reviews = await q.orderBy(reviewsTable.createdAt);
  res.json(ListReviewsResponse.parse(serialize(reviews)));
});

router.post("/reviews", async (req, res): Promise<void> => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [review] = await db.insert(reviewsTable).values(parsed.data).returning();

  const statusMap: Record<string, string> = {
    approved: "approved",
    revision_requested: "revision_requested",
    rejected: "rejected",
  };
  const newStatus = statusMap[parsed.data.reviewStatus];
  if (newStatus) {
    await db
      .update(indicatorResultsTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(indicatorResultsTable.id, parsed.data.resultId));
  }

  res.status(201).json(serialize(review));
});

export default router;
