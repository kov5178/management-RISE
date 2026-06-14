import { pgTable, text, serial, timestamp, integer, real, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";

export const indicatorsTable = pgTable("indicators", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  sourceIndicatorId: text("source_indicator_id").notNull(),
  indicatorType: text("indicator_type").notNull().default("child"),
  indicatorScope: text("indicator_scope").notNull().default("PROJECT"),
  sourceScopeName: text("source_scope_name"),
  calculationMode: text("calculation_mode").notNull().default("DIRECT_INPUT"),
  sourceLevelConfidence: text("source_level_confidence").notNull().default("EXPLICIT"),
  sourceLevelName: text("source_level_name"),
  sourceExcelRow: integer("source_excel_row"),
  isRegionalAggregate: boolean("is_regional_aggregate").notNull().default(false),
  formulaType: text("formula_type"),
  baselineValue: real("baseline_value"),
  ownerName: text("owner_name"),
  name: text("name").notNull(),
  unit: text("unit"),
  formula: text("formula"),
  weight: real("weight"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("uq_indicators_source_indicator_id").on(t.sourceIndicatorId),
]);

export const insertIndicatorSchema = createInsertSchema(indicatorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIndicator = z.infer<typeof insertIndicatorSchema>;
export type Indicator = typeof indicatorsTable.$inferSelect;
