import bcrypt from "bcryptjs";
import { db, pool, usersTable } from "@workspace/db";
import { count } from "drizzle-orm";
import { logger } from "./logger";

async function ensureSessionsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    ) WITH (OIDS=FALSE);
    CREATE INDEX IF NOT EXISTS "IDX_sessions_expire" ON "sessions" ("expire");
  `);
}

async function ensureSettingsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "settings" (
      "key" text NOT NULL,
      "value" text NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
    );
  `);
}

async function ensureAdminUser(): Promise<void> {
  const [row] = await db.select({ cnt: count() }).from(usersTable);
  if (!row || row.cnt > 0) return;

  logger.info("No users found — seeding initial super admin (admin001 / 1111)");

  const passwordHash = await bcrypt.hash("1111", 12);
  await db.insert(usersTable).values({
    employeeNo: "admin001",
    name: "시스템 관리자",
    email: "admin@koreatech.ac.kr",
    passwordHash,
    role: "super_admin",
    status: "active",
    department: "정보전산처",
    position: "관리자",
    mustChangePassword: true,
    isSeedAdmin: true,
  });

  logger.info("Initial super admin created: admin001 (must change password on first login)");
}

export async function initDb(): Promise<void> {
  try {
    await ensureSessionsTable();
  } catch (err) {
    logger.error({ err }, "Failed to create sessions table");
  }
  try {
    await ensureSettingsTable();
  } catch (err) {
    logger.error({ err }, "Failed to create settings table");
  }
  try {
    await ensureAdminUser();
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}
