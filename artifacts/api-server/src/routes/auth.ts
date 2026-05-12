import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

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

  res.json({
    id: user.id,
    name: user.name,
    employeeNo: user.employeeNo,
    email: user.email,
    role: user.role,
    department: user.department,
    status: user.status,
  });
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
  res.json(serialize({
    id: user.id,
    name: user.name,
    employeeNo: user.employeeNo,
    email: user.email,
    role: user.role,
    department: user.department,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
  }));
});

export default router;
