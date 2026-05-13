import nodemailer from "nodemailer";
import { logger } from "./logger.js";

function createTransport() {
  const host = process.env["SMTP_HOST"];
  const port = parseInt(process.env["SMTP_PORT"] ?? "587");
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return null;
}

export async function sendOtpEmail(
  to: string,
  otp: string,
  name: string,
): Promise<void> {
  const from = process.env["SMTP_FROM"] ?? "RISE 성과관리 <noreply@rise.system.local>";
  const subject = "[RISE 성과관리] 비밀번호 재설정 인증코드";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1e293b">비밀번호 재설정 인증코드</h2>
      <p>안녕하세요, <strong>${name}</strong>님.</p>
      <p>아래 인증코드를 10분 이내에 입력해 주세요.</p>
      <div style="background:#f1f5f9;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1e293b">${otp}</span>
      </div>
      <p style="color:#64748b;font-size:13px">
        본인이 요청하지 않았다면 이 이메일을 무시하세요.<br>
        인증코드는 10분 후 만료됩니다.
      </p>
    </div>
  `;

  const transport = createTransport();
  if (transport) {
    await transport.sendMail({ from, to, subject, html });
    logger.info({ to }, "OTP email sent");
  } else {
    logger.warn(
      { to, otp },
      "SMTP not configured — OTP logged to console (dev mode)",
    );
    console.log(`\n========== [DEV] OTP for ${to} ==========\n  Code: ${otp}\n==========================================\n`);
  }
}
