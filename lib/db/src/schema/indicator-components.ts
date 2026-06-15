import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { indicatorsTable } from "./indicators";

export const indicatorComponentRoles = ["VALUE", "NUMERATOR_VALUE", "DENOMINATOR_VALUE", "WEIGHT"] as const;
export type IndicatorComponentRole = (typeof indicatorComponentRoles)[number];

export const indicatorComponentsTable = pgTable("indicator_components", {
  id: serial("id").primaryKey(),
  parentIndicatorId: integer("parent_indicator_id").notNull().references(() => indicatorsTable.id, { onDelete: "cascade" }),
  componentIndicatorId: integer("component_indicator_id").notNull().references(() => indicatorsTable.id, { onDelete: "cascade" }),
  componentRole: text("component_role").$type<IndicatorComponentRole>().notNull().default("VALUE"),
  weight: real("weight"),
  sortOrder: integer("sort_order").notNull().default(0),
  sourceFormula: text("source_formula"),
  sourceFormulaCell: text("source_formula_cell"),
  sourceExcelSheet: text("source_excel_sheet"),
  sourceExcelRow: integer("source_excel_row"),
  reviewRequired: boolean("review_required").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIndicatorComponentSchema = createInsertSchema(indicatorComponentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIndicatorComponent = z.infer<typeof insertIndicatorComponentSchema>;
export type IndicatorComponent = typeof indicatorComponentsTable.$inferSelect;
