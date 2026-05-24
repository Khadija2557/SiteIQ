import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const workersTable = pgTable("workers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  trade: text("trade").notNull(),
  certifications: text("certifications").array().notNull().default([]),
  zone: text("zone").notNull(),
  status: text("status").notNull().default("active"),
  ppeScore: integer("ppe_score").notNull().default(100),
  fatigueScore: integer("fatigue_score").notNull().default(0),
  locationX: real("location_x"),
  locationY: real("location_y"),
  shiftStart: timestamp("shift_start"),
  userId: integer("user_id").references(() => usersTable.id),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWorkerSchema = createInsertSchema(workersTable).omit({ id: true, createdAt: true });
export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type Worker = typeof workersTable.$inferSelect;
