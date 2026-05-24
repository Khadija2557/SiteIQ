import { pgTable, serial, text, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { cameraFeedsTable } from "./cameras";
import { workersTable } from "./workers";

export const cvEventsTable = pgTable("cv_events", {
  id: serial("id").primaryKey(),
  cameraId: integer("camera_id"),
  eventType: text("event_type").notNull(),
  confidence: real("confidence").notNull().default(0),
  bbox: jsonb("bbox"),
  workerId: integer("worker_id").references(() => workersTable.id),
  processed: text("processed").notNull().default("false"),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCvEventSchema = createInsertSchema(cvEventsTable).omit({ id: true, createdAt: true });
export type InsertCvEvent = z.infer<typeof insertCvEventSchema>;
export type CvEvent = typeof cvEventsTable.$inferSelect;
