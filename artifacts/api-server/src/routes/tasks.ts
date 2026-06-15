import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  CreateTaskBody,
  UpdateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  DeleteTaskParams,
  ListTasksQueryParams,
  ListTasksResponse,
  GetTaskResponse,
  UpdateTaskResponse,
} from "@workspace/api-zod";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();
const allowedTaskStatuses = new Set(["active", "completed", "planned"]);

function parseOptionalProjectId(body: unknown): number | undefined {
  if (!body || typeof body !== "object" || !("projectId" in body)) return undefined;
  const value = Number((body as { projectId?: unknown }).projectId);
  return Number.isInteger(value) && value > 0 ? value : NaN;
}

router.get("/tasks", async (req, res): Promise<void> => {
  const query = ListTasksQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  let q = db.select().from(tasksTable).$dynamic();
  if (query.data.projectId) {
    q = q.where(eq(tasksTable.projectId, query.data.projectId));
  }
  const tasks = await q.orderBy(tasksTable.createdAt);
  res.json(ListTasksResponse.parse(serialize(tasks)));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db.insert(tasksTable).values(parsed.data).returning();
  res.status(201).json(GetTaskResponse.parse(serialize(task)));
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));
  if (!task) {
    res.status(404).json({ error: "단위과제를 찾을 수 없습니다." });
    return;
  }
  res.json(GetTaskResponse.parse(serialize(task)));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const projectId = parseOptionalProjectId(req.body);
  if (Number.isNaN(projectId)) {
    res.status(400).json({ error: "유효한 소속 프로젝트를 선택해주세요." });
    return;
  }
  if (parsed.data.status && !allowedTaskStatuses.has(parsed.data.status)) {
    res.status(400).json({ error: "상태는 active, completed, planned 중 하나여야 합니다." });
    return;
  }

  const [task] = await db
    .update(tasksTable)
    .set({
      ...parsed.data,
      ...(projectId !== undefined ? { projectId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tasksTable.id, params.data.id))
    .returning();
  if (!task) {
    res.status(404).json({ error: "단위과제를 찾을 수 없습니다." });
    return;
  }
  res.json(UpdateTaskResponse.parse(serialize(task)));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id)).returning();
  if (!task) {
    res.status(404).json({ error: "단위과제를 찾을 수 없습니다." });
    return;
  }
  res.sendStatus(204);
});

export default router;
