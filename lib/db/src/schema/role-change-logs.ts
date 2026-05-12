import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleChangeLogsTable = pgTable("role_change_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  oldRole: text("old_role").notNull(),
  newRole: text("new_role").notNull(),
  changedBy: integer("changed_by").notNull(),
  changerRole: text("changer_role").notNull(),
  reason: text("reason"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRoleChangeLogSchema = createInsertSchema(roleChangeLogsTable).omit({ id: true, changedAt: true });
export type InsertRoleChangeLog = z.infer<typeof insertRoleChangeLogSchema>;
export type RoleChangeLog = typeof roleChangeLogsTable.$inferSelect;
