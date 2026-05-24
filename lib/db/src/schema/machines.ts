import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { workersTable } from "./workers";

export const machinesTable = pgTable("machines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("idle"),
  zone: text("zone").notNull(),
  locationX: real("location_x"),
  locationY: real("location_y"),
  operatorId: integer("operator_id").references(() => workersTable.id),
  utilizationPct: integer("utilization_pct").default(0),
  maintenanceDue: timestamp("maintenance_due"),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMachineSchema = createInsertSchema(machinesTable).omit({ id: true, createdAt: true });
export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type Machine = typeof machinesTable.$inferSelect;
