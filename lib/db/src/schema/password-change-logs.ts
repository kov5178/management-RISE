import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const passwordChangeLogsTable = pgTable("password_change_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  employeeNo: text("employee_no").notNull(),
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PasswordChangeLog = typeof passwordChangeLogsTable.$inferSelect;
