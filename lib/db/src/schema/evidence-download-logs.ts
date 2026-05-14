import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { evidenceFilesTable } from "./evidence";
import { usersTable } from "./users";

export const evidenceDownloadLogsTable = pgTable("evidence_download_logs", {
  id: serial("id").primaryKey(),
  evidenceId: integer("evidence_id").notNull().references(() => evidenceFilesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
});

export type EvidenceDownloadLog = typeof evidenceDownloadLogsTable.$inferSelect;
