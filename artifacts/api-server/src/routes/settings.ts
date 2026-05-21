import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { requireRole } from "../middlewares/auth.js";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;
const VALID_TIMEOUT_OPTIONS = [15, 30, 60, 120];

async function getSettingValue(key: string, defaultValue: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value ?? defaultValue;
}

router.get("/settings", async (req, res): Promise<void> => {
  const timeoutStr = await getSettingValue(
    "session_timeout_minutes",
    String(DEFAULT_SESSION_TIMEOUT_MINUTES),
  );
  const sessionTimeoutMinutes = parseInt(timeoutStr, 10) || DEFAULT_SESSION_TIMEOUT_MINUTES;
  res.json({ sessionTimeoutMinutes });
});

router.put("/settings", requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const { sessionTimeoutMinutes } = req.body as { sessionTimeoutMinutes: unknown };

  if (
    typeof sessionTimeoutMinutes !== "number" ||
    !Number.isInteger(sessionTimeoutMinutes) ||
    !VALID_TIMEOUT_OPTIONS.includes(sessionTimeoutMinutes)
  ) {
    res.status(400).json({
      error: `sessionTimeoutMinutes는 ${VALID_TIMEOUT_OPTIONS.join(", ")} 중 하나여야 합니다.`,
    });
    return;
  }

  await db
    .insert(settingsTable)
    .values({ key: "session_timeout_minutes", value: String(sessionTimeoutMinutes) })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: String(sessionTimeoutMinutes), updatedAt: new Date() },
    });

  req.log.info({ sessionTimeoutMinutes }, "Settings updated");
  res.json({ sessionTimeoutMinutes });
});

export default router;
