import { pgTable, text, serial, timestamp, integer, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { indicatorsTable } from "./indicators";

export const indicatorTargetsTable = pgTable("indicator_targets", {
  id: serial("id").primaryKey(),
  indicatorId: integer("indicator_id").notNull().references(() => indicatorsTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  targetValue: real("target_value"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("uq_indicator_targets_indicator_year").on(t.indicatorId, t.year),
]);

export const insertTargetSchema = createInsertSchema(indicatorTargetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTarget = z.infer<typeof insertTargetSchema>;
export type IndicatorTarget = typeof indicatorTargetsTable.$inferSelect;
