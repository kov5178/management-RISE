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

router.post("/auth/login", async (req, res): Promise<void> => {
  const { employeeNo, password } = req.body;
  if (!employeeNo || !password) {
    res.status(400).json({ error: "직번/사번과 비밀번호를 입력하세요." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.employeeNo, employeeNo));
  if (!user) {
    res.status(401).json({ error: "직번/사번 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  const validStatuses = ["active"];
  if (!validStatuses.includes(user.status)) {
    const messages: Record<string, string> = {
      pending: "승인 대기 중인 계정입니다. 관리자 승인 후 로그인 가능합니다.",
      rejected: "반려된 계정입니다. 관리자에게 문의하세요.",
      inactive: "비활성화된 계정입니다. 관리자에게 문의하세요.",
      locked: "잠긴 계정입니다. 관리자에게 문의하세요.",
    };
    res.status(403).json({ error: messages[user.status] ?? "로그인할 수 없는 계정입니다." });
    return;
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    res.status(401).json({ error: "직번/사번 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  req.session.userId = user.id;
  req.session.employeeNo = user.employeeNo;
  req.session.name = user.name;
  req.session.role = user.role;
  req.session.status = user.status;

  res.json(serialize(formatUser(user)));
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "사용자를 찾을 수 없습니다." });
    return;
  }
  res.json(serialize(formatUser(user)));
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
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

router.post("/auth/demo-login", async (req, res): Promise<void> => {
  if (process.env.DEMO_MODE_ENABLED !== "true") {
    res.status(403).json({ error: "데모 모드가 활성화되지 않았습니다." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .limit(1);

  if (!user) {
    res.status(500).json({ error: "데모 사용자를 찾을 수 없습니다." });
    return;
  }

  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  req.session.userId = user.id;
  req.session.employeeNo = user.employeeNo;
  req.session.name = user.name;
  req.session.role = user.role;
  req.session.status = user.status;

  const updatedUser = { ...user, lastLoginAt: new Date() };
  res.json(serialize(formatUser(updatedUser)));
});

export default router;
