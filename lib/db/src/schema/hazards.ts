import { pgTable, serial, text, real, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const hazardsTable = pgTable("hazards", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("medium"),
  zone: text("zone").notNull(),
  locationX: real("location_x"),
  locationY: real("location_y"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
});

export const insertHazardSchema = createInsertSchema(hazardsTable).omit({ id: true, detectedAt: true });
export type InsertHazard = z.infer<typeof insertHazardSchema>;
export type Hazard = typeof hazardsTable.$inferSelect;
