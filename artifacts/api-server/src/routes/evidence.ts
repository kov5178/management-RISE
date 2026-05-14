import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, evidenceFilesTable, evidenceDownloadLogsTable } from "@workspace/db";
import {
  CreateEvidenceBody,
  DeleteEvidenceParams,
  DownloadEvidenceParams,
  DownloadEvidenceResponse,
  ListEvidenceQueryParams,
  ListEvidenceResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize.js";

const DOWNLOAD_ALLOWED_ROLES = ["reporter", "manager", "reviewer", "admin", "super_admin"];

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

router.get("/evidence/:id/download", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "로그인이 필요합니다." });
    return;
  }
  if (!DOWNLOAD_ALLOWED_ROLES.includes(req.session.role ?? "")) {
    res.status(403).json({ error: "다운로드 권한이 없습니다. (task_manager 이상 권한 필요)" });
    return;
  }

  const params = DownloadEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "잘못된 요청입니다." });
    return;
  }

  const [file] = await db
    .select()
    .from(evidenceFilesTable)
    .where(eq(evidenceFilesTable.id, params.data.id));

  if (!file) {
    res.status(404).json({ error: "증빙자료를 찾을 수 없습니다." });
    return;
  }

  await db.insert(evidenceDownloadLogsTable).values({
    evidenceId: file.id,
    userId: req.session.userId,
    ipAddress: req.ip ?? null,
  });

  res.json(DownloadEvidenceResponse.parse(serialize(file)));
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
