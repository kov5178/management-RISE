import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const registrationRequestsTable = pgTable("registration_requests", {
  id: serial("id").primaryKey(),
  employeeNo: text("employee_no").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  department: text("department"),
  position: text("position"),
  passwordHash: text("password_hash").notNull(),
  requestReason: text("request_reason"),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewComment: text("review_comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRegistrationRequestSchema = createInsertSchema(registrationRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRegistrationRequest = z.infer<typeof insertRegistrationRequestSchema>;
export type RegistrationRequest = typeof registrationRequestsTable.$inferSelect;
