import { pgTable, text, serial, timestamp, integer, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { indicatorsTable } from "./indicators";

export const indicatorResultValueSources = ["MANUAL", "CALCULATED", "IMPORTED"] as const;
export type IndicatorResultValueSource = (typeof indicatorResultValueSources)[number];

export const indicatorResultsTable = pgTable("indicator_results", {
  id: serial("id").primaryKey(),
  indicatorId: integer("indicator_id").notNull().references(() => indicatorsTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  marValue: real("mar_value"),
  aprValue: real("apr_value"),
  mayValue: real("may_value"),
  junValue: real("jun_value"),
  julValue: real("jul_value"),
  augValue: real("aug_value"),
  sepValue: real("sep_value"),
  octValue: real("oct_value"),
  novValue: real("nov_value"),
  decValue: real("dec_value"),
  janValue: real("jan_value"),
  febValue: real("feb_value"),
  note: text("note"),
  calculatedValue: real("calculated_value"),
  progressRate: real("progress_rate"),
  valueSource: text("value_source").$type<IndicatorResultValueSource>().notNull().default("MANUAL"),
  status: text("status").notNull().default("draft"),
  selfEvaluation: text("self_evaluation"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("uq_indicator_results_indicator_year").on(t.indicatorId, t.year),
]);

export const insertResultSchema = createInsertSchema(indicatorResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertResult = z.infer<typeof insertResultSchema>;
export type IndicatorResult = typeof indicatorResultsTable.$inferSelect;
