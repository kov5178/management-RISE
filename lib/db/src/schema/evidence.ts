import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { indicatorResultsTable } from "./results";

export const evidenceFilesTable = pgTable("evidence_files", {
  id: serial("id").primaryKey(),
  resultId: integer("result_id").notNull().references(() => indicatorResultsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEvidenceSchema = createInsertSchema(evidenceFilesTable).omit({ id: true, createdAt: true });
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type EvidenceFile = typeof evidenceFilesTable.$inferSelect;
