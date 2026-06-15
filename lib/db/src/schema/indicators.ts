import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";

export const indicatorsTable = pgTable("indicators", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  indicatorType: text("indicator_type").notNull().default("child"),
  calculationMode: text("calculation_mode").notNull().default("DIRECT_INPUT"),
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
