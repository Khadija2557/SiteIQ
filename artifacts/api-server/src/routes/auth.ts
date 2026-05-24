import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { requireAuth, signToken } from "../middleware/auth";
import crypto from "crypto";

const router = Router();

export const tokenBlocklist = new Set<string>();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "siteiq-salt").digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email });
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId, createdAt: user.createdAt },
  });
});

router.post("/auth/logout", requireAuth, (req, res): void => {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    tokenBlocklist.add(authHeader.slice(7));
  }
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.auth!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, email: user.email, role: user.role, tenantId: user.tenantId, createdAt: user.createdAt });
});

router.post("/auth/register-tenant", async (req, res): Promise<void> => {
  const { tenantName, adminEmail, adminPassword, plan } = req.body as {
    tenantName: string;
    adminEmail: string;
    adminPassword: string;
    plan?: string;
  };
  if (!tenantName || !adminEmail || !adminPassword) {
    res.status(400).json({ error: "tenantName, adminEmail, and adminPassword are required" });
    return;
  }
  if (adminPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const slug = tenantName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const existing = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Tenant with this name already exists" });
    return;
  }
  const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail.toLowerCase().trim())).limit(1);
  if (existingUser.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const [tenant] = await db.insert(tenantsTable).values({
    name: tenantName,
    slug,
    plan: plan ?? "starter",
    active: true,
  }).returning();
  const [user] = await db.insert(usersTable).values({
    email: adminEmail.toLowerCase().trim(),
    passwordHash: hashPassword(adminPassword),
    role: "admin",
    tenantId: tenant.id,
  }).returning();
  const token = signToken({ userId: user.id, tenantId: tenant.id, role: user.role, email: user.email });
  res.status(201).json({
    token,
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
    user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
  });
});

export default router;
