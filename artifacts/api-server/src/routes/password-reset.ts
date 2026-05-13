import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and, gt } from "drizzle-orm";
import { db, usersTable, passwordResetTokensTable, passwordChangeLogsTable } from "@workspace/db";
import { sendOtpEmail } from "../lib/email.js";
import { serialize } from "../lib/serialize.js";

const router: IRouter = Router();

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function logPasswordChange(
  userId: number | null,
  employeeNo: string,
  success: boolean,
  failureReason: string | null,
  ipAddress: string | null,
) {
  await db.insert(passwordChangeLogsTable).values({
    userId,
    employeeNo,
    success,
    failureReason,
    ipAddress,
  });
}

// Step 1: 신원 확인 + OTP 발송
router.post("/auth/request-password-reset", async (req, res): Promise<void> => {
  const { employeeNo, name, email, currentPassword } = req.body;
  const ip = req.ip ?? null;

  if (!employeeNo || !name || !email || !currentPassword) {
    res.status(400).json({ error: "모든 필드를 입력하세요." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.employeeNo, employeeNo));

  if (!user) {
    await logPasswordChange(null, employeeNo, false, "user_not_found", ip);
    res.status(400).json({ error: "입력한 정보와 일치하는 계정이 없습니다." });
    return;
  }

  // 계정 상태 확인
  if (user.status !== "active") {
    const messages: Record<string, string> = {
      pending: "승인 대기 중인 계정입니다. 관리자 승인 후 이용 가능합니다.",
      rejected: "반려된 계정입니다. 관리자에게 문의하세요.",
      inactive: "비활성화된 계정입니다. 관리자에게 문의하세요.",
      locked: "잠긴 계정입니다. 관리자에게 문의하세요.",
    };
    await logPasswordChange(user.id, employeeNo, false, `account_${user.status}`, ip);
    res.status(403).json({ error: messages[user.status] ?? "이용할 수 없는 계정입니다." });
    return;
  }

  // 이름, 이메일 일치 확인
  if (user.name.trim() !== name.trim()) {
    await logPasswordChange(user.id, employeeNo, false, "name_mismatch", ip);
    res.status(400).json({ error: "입력한 정보와 일치하는 계정이 없습니다." });
    return;
  }

  if (user.email.toLowerCase() !== email.toLowerCase().trim()) {
    await logPasswordChange(user.id, employeeNo, false, "email_mismatch", ip);
    res.status(400).json({ error: "입력한 정보와 일치하는 계정이 없습니다." });
    return;
  }

  // 현재 비밀번호 확인
  const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordValid) {
    await logPasswordChange(user.id, employeeNo, false, "wrong_current_password", ip);
    res.status(400).json({ error: "임시 비밀번호가 올바르지 않습니다." });
    return;
  }

  // 기존 미사용 토큰 무효화 (used=true)
  await db
    .update(passwordResetTokensTable)
    .set({ used: true })
    .where(
      and(
        eq(passwordResetTokensTable.userId, user.id),
        eq(passwordResetTokensTable.used, false),
      ),
    );

  // OTP 생성 및 저장
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    otpHash,
    expiresAt,
  });

  // 이메일 발송
  try {
    await sendOtpEmail(user.email, otp, user.name);
  } catch (err) {
    await logPasswordChange(user.id, employeeNo, false, "email_send_failed", ip);
    res.status(500).json({ error: "인증코드 발송에 실패했습니다. 잠시 후 다시 시도하세요." });
    return;
  }

  res.json(serialize({ ok: true, maskedEmail: maskEmail(user.email) }));
});

// Step 2: OTP 검증 + 새 비밀번호 설정
router.post("/auth/confirm-password-reset", async (req, res): Promise<void> => {
  const { employeeNo, otp, newPassword, newPasswordConfirm } = req.body;
  const ip = req.ip ?? null;

  if (!employeeNo || !otp || !newPassword || !newPasswordConfirm) {
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

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.employeeNo, employeeNo));

  if (!user) {
    res.status(400).json({ error: "계정을 찾을 수 없습니다." });
    return;
  }

  if (user.status !== "active") {
    res.status(403).json({ error: "이용할 수 없는 계정입니다." });
    return;
  }

  // 새 비밀번호 제한 검사
  if (newPassword === employeeNo) {
    res.status(400).json({ error: "비밀번호는 직번/사번과 동일할 수 없습니다." });
    return;
  }
  if (newPassword === "1111") {
    res.status(400).json({ error: "초기 비밀번호(1111)는 사용할 수 없습니다." });
    return;
  }
  const sameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsCurrent) {
    res.status(400).json({ error: "기존 비밀번호와 동일한 비밀번호는 사용할 수 없습니다." });
    return;
  }

  // 유효한 OTP 토큰 조회
  const now = new Date();
  const tokens = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.userId, user.id),
        eq(passwordResetTokensTable.used, false),
        gt(passwordResetTokensTable.expiresAt, now),
      ),
    );

  if (tokens.length === 0) {
    await logPasswordChange(user.id, employeeNo, false, "no_valid_token", ip);
    res.status(400).json({ error: "인증코드가 만료됐거나 유효하지 않습니다. 다시 요청해 주세요." });
    return;
  }

  // 가장 최근 토큰과 OTP 비교
  const latestToken = tokens[tokens.length - 1]!;
  const otpValid = await bcrypt.compare(otp, latestToken.otpHash);
  if (!otpValid) {
    await logPasswordChange(user.id, employeeNo, false, "wrong_otp", ip);
    res.status(400).json({ error: "인증코드가 올바르지 않습니다." });
    return;
  }

  // 비밀번호 변경
  const newHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(usersTable)
    .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  // 토큰 사용 처리
  await db
    .update(passwordResetTokensTable)
    .set({ used: true })
    .where(eq(passwordResetTokensTable.id, latestToken.id));

  await logPasswordChange(user.id, employeeNo, true, null, ip);

  res.json({ ok: true });
});

export default router;
