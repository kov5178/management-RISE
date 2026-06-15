import { pgTable, pgEnum, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";

export const indicatorCalculationModeEnum = pgEnum("indicator_calculation_mode", ["AUTO_FROM_CHILDREN", "DIRECT_INPUT"]);
export const indicatorLevelEnum = pgEnum("indicator_level", ["PARENT", "CHILD"]);
export const indicatorScopeEnum = pgEnum("indicator_scope", ["PROJECT", "CHUNGBUK", "UNIVERSITY"]);

export type IndicatorCalculationMode = (typeof indicatorCalculationModeEnum.enumValues)[number];
export type IndicatorLevel = (typeof indicatorLevelEnum.enumValues)[number];
export type IndicatorScope = (typeof indicatorScopeEnum.enumValues)[number];

export const indicatorsTable = pgTable("indicators", {
  id: serial("id").primaryKey(),
  sourceIndicatorId: text("source_indicator_id").unique(),
  sourceParentIndicatorId: text("source_parent_indicator_id"),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  indicatorType: text("indicator_type").notNull().default("child"),
  indicatorScope: indicatorScopeEnum("indicator_scope").notNull().default("PROJECT"),
  sourceScopeName: text("source_scope_name"),
  isRegionalAggregate: boolean("is_regional_aggregate").notNull().default(false),
  indicatorLevel: indicatorLevelEnum("indicator_level").notNull().default("CHILD"),
  calculationMode: indicatorCalculationModeEnum("calculation_mode").notNull().default("DIRECT_INPUT"),
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
