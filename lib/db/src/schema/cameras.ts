import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const cameraFeedsTable = pgTable("camera_feeds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  rtspUrl: text("rtsp_url"),
  zone: text("zone").notNull(),
  status: text("status").notNull().default("online"),
  lastFrameAt: timestamp("last_frame_at"),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCameraFeedSchema = createInsertSchema(cameraFeedsTable).omit({ id: true, createdAt: true });
export type InsertCameraFeed = z.infer<typeof insertCameraFeedSchema>;
export type CameraFeed = typeof cameraFeedsTable.$inferSelect;
