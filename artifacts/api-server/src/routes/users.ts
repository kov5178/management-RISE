import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, roleChangeLogsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      employeeNo: usersTable.employeeNo,
      role: usersTable.role,
      status: usersTable.status,
      department: usersTable.department,
      position: usersTable.position,
      lastLoginAt: usersTable.lastLoginAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json(serialize(users));
});

router.patch("/users/:id/status", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { status } = req.body;
  const validStatuses = ["active", "inactive", "locked"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: `status는 ${validStatuses.join(", ")} 중 하나여야 합니다.` });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "사용자를 찾을 수 없습니다." }); return; }
  res.json(serialize(updated));
});

router.patch("/users/:id/role", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { role, reason } = req.body;
  const validRoles = ["super_admin", "admin", "project_manager", "task_manager", "reviewer", "viewer"];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: `role은 ${validRoles.join(", ")} 중 하나여야 합니다.` });
    return;
  }

  const changerRole = req.session.role ?? "";
  if (changerRole !== "super_admin" && role === "super_admin") {
    res.status(403).json({ error: "최고관리자 권한은 최고관리자만 부여할 수 있습니다." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "사용자를 찾을 수 없습니다." }); return; }

  const oldRole = user.role;
  const [updated] = await db
    .update(usersTable)
    .set({ role, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();

  await db.insert(roleChangeLogsTable).values({
    userId: id,
    oldRole,
    newRole: role,
    changedBy: req.session.userId!,
    changerRole,
    reason: reason ?? null,
  });

  res.json(serialize(updated));
});

router.get("/role-change-logs", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const logs = await db.select().from(roleChangeLogsTable).orderBy(roleChangeLogsTable.changedAt);

  const users = await db.select({ id: usersTable.id, name: usersTable.name, employeeNo: usersTable.employeeNo }).from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const enriched = logs.map((log) => ({
    ...log,
    userName: userMap.get(log.userId)?.name ?? "알 수 없음",
    userEmployeeNo: userMap.get(log.userId)?.employeeNo ?? "",
    changerName: userMap.get(log.changedBy)?.name ?? "알 수 없음",
    changerEmployeeNo: userMap.get(log.changedBy)?.employeeNo ?? "",
  }));

  res.json(serialize(enriched));
});

export default router;
