import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { machinesTable } from "./machines";

export const deliveriesTable = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  materialType: text("material_type").notNull(),
  quantity: integer("quantity").notNull(),
  eta: timestamp("eta"),
  status: text("status").notNull().default("pending"),
  gate: text("gate").notNull(),
  assignedForkLiftId: integer("assigned_forklift_id").references(() => machinesTable.id),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeliverySchema = createInsertSchema(deliveriesTable).omit({ id: true, createdAt: true });
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type Delivery = typeof deliveriesTable.$inferSelect;
