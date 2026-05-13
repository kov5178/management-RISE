import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    employeeNo: user.employeeNo,
    email: user.email,
    role: user.role,
    department: user.department,
    position: user.position,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
  };
}

router.patch("/auth/me/password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;

  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    res.status(400).json({ error: "모든 필드를 입력하세요." });
    return;
  }

  if (newPassword !== newPasswordConfirm) {
    res.status(400).json({ error: "새 비밀번호가 일치하지 않습니다." });
    return;
  }

  if (newPassword.length < 4) {
    res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) {
    res.status(401).json({ error: "사용자를 찾을 수 없습니다." });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "현재 비밀번호가 올바르지 않습니다." });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(usersTable)
    .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  res.json({ ok: true });
});

router.patch("/auth/me/profile", requireAuth, async (req, res): Promise<void> => {
  const { name, department, position } = req.body;

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    res.status(400).json({ error: "이름을 올바르게 입력하세요." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) {
    res.status(401).json({ error: "사용자를 찾을 수 없습니다." });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert & { updatedAt: Date }> = {
    updatedAt: new Date(),
  };
  if (name !== undefined) updates.name = name.trim();
  if (department !== undefined) updates.department = department || null;
  if (position !== undefined) updates.position = position || null;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, user.id))
    .returning();

  if (name !== undefined) {
    req.session.name = updated.name;
  }

  res.json(serialize(formatUser(updated)));
});

export default router;
