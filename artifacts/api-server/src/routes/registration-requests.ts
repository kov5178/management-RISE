import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, or, and } from "drizzle-orm";
import { db, usersTable, registrationRequestsTable } from "@workspace/db";
import { requireRole } from "../middlewares/auth.js";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

router.post("/registration-requests", async (req, res): Promise<void> => {
  const { employeeNo, email, name, department, position, password, passwordConfirm, requestReason } = req.body;

  if (!employeeNo || !email || !name || !password || !passwordConfirm) {
    res.status(400).json({ error: "필수 항목을 모두 입력하세요." });
    return;
  }
  if (password !== passwordConfirm) {
    res.status(400).json({ error: "비밀번호와 비밀번호 확인이 일치하지 않습니다." });
    return;
  }

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.employeeNo, employeeNo), eq(usersTable.email, email)));
  if (existingUser) {
    if (existingUser.employeeNo === employeeNo) {
      res.status(409).json({ error: "이미 등록된 직번/사번입니다." });
    } else {
      res.status(409).json({ error: "이미 등록된 이메일입니다." });
    }
    return;
  }

  const [pendingReq] = await db
    .select()
    .from(registrationRequestsTable)
    .where(
      and(
        or(
          eq(registrationRequestsTable.employeeNo, employeeNo),
          eq(registrationRequestsTable.email, email)
        ),
        eq(registrationRequestsTable.status, "pending")
      )
    );
  if (pendingReq) {
    res.status(409).json({ error: "이미 동일한 직번/사번 또는 이메일로 대기 중인 등록 요청이 있습니다." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db
    .insert(registrationRequestsTable)
    .values({ employeeNo, email, name, department, position, passwordHash, requestReason, status: "pending" })
    .returning();

  res.status(201).json(serialize(created));
});

router.get("/registration-requests", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const { status } = req.query;
  let query = db.select().from(registrationRequestsTable);
  if (status && typeof status === "string") {
    const filtered = await db
      .select()
      .from(registrationRequestsTable)
      .where(eq(registrationRequestsTable.status, status))
      .orderBy(registrationRequestsTable.createdAt);
    res.json(serialize(filtered));
    return;
  }
  const all = await query.orderBy(registrationRequestsTable.createdAt);
  res.json(serialize(all));
});

router.patch("/registration-requests/:id/approve", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [request] = await db.select().from(registrationRequestsTable).where(eq(registrationRequestsTable.id, id));
  if (!request) { res.status(404).json({ error: "요청을 찾을 수 없습니다." }); return; }
  if (request.status !== "pending") { res.status(409).json({ error: "이미 처리된 요청입니다." }); return; }

  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.employeeNo, request.employeeNo), eq(usersTable.email, request.email)));
  if (existingUser) {
    res.status(409).json({ error: "이미 동일한 직번/사번 또는 이메일의 사용자가 존재합니다." });
    return;
  }

  const now = new Date();
  await db
    .update(registrationRequestsTable)
    .set({ status: "approved", reviewedBy: req.session.userId, reviewedAt: now, reviewComment: req.body.reviewComment ?? null, updatedAt: now })
    .where(eq(registrationRequestsTable.id, id));

  const [newUser] = await db
    .insert(usersTable)
    .values({
      employeeNo: request.employeeNo,
      email: request.email,
      name: request.name,
      department: request.department,
      position: request.position,
      passwordHash: request.passwordHash,
      role: "viewer",
      status: "active",
    })
    .returning();

  res.json(serialize(newUser));
});

router.patch("/registration-requests/:id/reject", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [request] = await db.select().from(registrationRequestsTable).where(eq(registrationRequestsTable.id, id));
  if (!request) { res.status(404).json({ error: "요청을 찾을 수 없습니다." }); return; }
  if (request.status !== "pending") { res.status(409).json({ error: "이미 처리된 요청입니다." }); return; }

  const now = new Date();
  const [updated] = await db
    .update(registrationRequestsTable)
    .set({ status: "rejected", reviewedBy: req.session.userId, reviewedAt: now, reviewComment: req.body.reviewComment ?? null, updatedAt: now })
    .where(eq(registrationRequestsTable.id, id))
    .returning();

  res.json(serialize(updated));
});

export default router;
