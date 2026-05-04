import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { indicatorResultsTable } from "./results";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  resultId: integer("result_id").notNull().references(() => indicatorResultsTable.id, { onDelete: "cascade" }),
  reviewerName: text("reviewer_name").notNull(),
  reviewStatus: text("review_status").notNull(),
  comment: text("comment"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
