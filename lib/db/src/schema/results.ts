import { pgTable, text, serial, timestamp, integer, real, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { indicatorsTable } from "./indicators";

export const indicatorResultsTable = pgTable("indicator_results", {
  id: serial("id").primaryKey(),
  indicatorId: integer("indicator_id").notNull().references(() => indicatorsTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  programName: text("program_name").notNull(),
  resultDate: date("result_date").notNull(),
  actualValue: real("actual_value").notNull(),
  note: text("note"),
  calculatedValue: real("calculated_value"),
  progressRate: real("progress_rate"),
  status: text("status").notNull().default("draft"),
  selfEvaluation: text("self_evaluation"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertResultSchema = createInsertSchema(indicatorResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertResult = z.infer<typeof insertResultSchema>;
export type IndicatorResult = typeof indicatorResultsTable.$inferSelect;
