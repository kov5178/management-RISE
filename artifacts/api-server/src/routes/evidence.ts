import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, evidenceFilesTable } from "@workspace/db";
import {
  CreateEvidenceBody,
  DeleteEvidenceParams,
  ListEvidenceQueryParams,
  ListEvidenceResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

router.get("/evidence", async (req, res): Promise<void> => {
  const query = ListEvidenceQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  let q = db.select().from(evidenceFilesTable).$dynamic();
  if (query.data.resultId) {
    q = q.where(eq(evidenceFilesTable.resultId, query.data.resultId));
  }
  const files = await q.orderBy(evidenceFilesTable.createdAt);
  res.json(ListEvidenceResponse.parse(serialize(files)));
});

router.post("/evidence", async (req, res): Promise<void> => {
  const parsed = CreateEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [file] = await db.insert(evidenceFilesTable).values(parsed.data).returning();
  res.status(201).json(serialize(file));
});

router.delete("/evidence/:id", async (req, res): Promise<void> => {
  const params = DeleteEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [file] = await db.delete(evidenceFilesTable).where(eq(evidenceFilesTable.id, params.data.id)).returning();
  if (!file) {
    res.status(404).json({ error: "증빙자료를 찾을 수 없습니다." });
    return;
  }
  res.sendStatus(204);
});

export default router;
