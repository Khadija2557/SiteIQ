import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { workersTable } from "./workers";
import { machinesTable } from "./machines";
import { usersTable } from "./users";

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("medium"),
  message: text("message").notNull(),
  workerId: integer("worker_id").references(() => workersTable.id),
  machineId: integer("machine_id").references(() => machinesTable.id),
  zone: text("zone"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedBy: integer("acknowledged_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true, createdAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;
