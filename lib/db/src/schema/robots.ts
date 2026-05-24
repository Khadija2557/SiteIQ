import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { tasksTable } from "./tasks";

export const robotsTable = pgTable("robots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("idle"),
  apiKey: text("api_key"),
  currentTaskId: integer("current_task_id").references(() => tasksTable.id),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRobotSchema = createInsertSchema(robotsTable).omit({ id: true, createdAt: true });
export type InsertRobot = z.infer<typeof insertRobotSchema>;
export type Robot = typeof robotsTable.$inferSelect;
