import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";

export const indicatorCalculationModes = ["AUTO_FROM_CHILDREN", "DIRECT_INPUT"] as const;
export const indicatorLevels = ["PARENT", "CHILD"] as const;
export const indicatorScopes = ["PROJECT", "CHUNGBUK", "UNIVERSITY"] as const;

export type IndicatorCalculationMode = (typeof indicatorCalculationModes)[number];
export type IndicatorLevel = (typeof indicatorLevels)[number];
export type IndicatorScope = (typeof indicatorScopes)[number];

export const indicatorsTable = pgTable("indicators", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  indicatorType: text("indicator_type").notNull().default("child"),
  indicatorScope: text("indicator_scope").$type<IndicatorScope>().notNull().default("PROJECT"),
  sourceScopeName: text("source_scope_name"),
  isRegionalAggregate: boolean("is_regional_aggregate").notNull().default(false),
  indicatorLevel: text("indicator_level").$type<IndicatorLevel>().notNull().default("CHILD"),
  calculationMode: text("calculation_mode").$type<IndicatorCalculationMode>().notNull().default("DIRECT_INPUT"),
  formulaType: text("formula_type"),
  sourceLevelConfidence: text("source_level_confidence").notNull().default("EXPLICIT"),
  sourceExcelRow: integer("source_excel_row"),
  normalizedIndicatorName: text("normalized_indicator_name"),
  reviewRequired: boolean("review_required").notNull().default(false),
  name: text("name").notNull(),
  unit: text("unit"),
  formula: text("formula"),
  weight: real("weight"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIndicatorSchema = createInsertSchema(indicatorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIndicator = z.infer<typeof insertIndicatorSchema>;
export type Indicator = typeof indicatorsTable.$inferSelect;
