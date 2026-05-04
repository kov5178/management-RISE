import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";

export const feedbackActionsTable = pgTable("feedback_actions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  evaluationContent: text("evaluation_content"),
  improvementPlan: text("improvement_plan"),
  actionStatus: text("action_status").notNull().default("planned"),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFeedbackSchema = createInsertSchema(feedbackActionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type FeedbackAction = typeof feedbackActionsTable.$inferSelect;
