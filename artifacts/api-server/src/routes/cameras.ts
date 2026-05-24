import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, cameraFeedsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/cameras", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const cameras = await db.select().from(cameraFeedsTable).where(eq(cameraFeedsTable.tenantId, tenantId));
  res.json(cameras);
});

export default router;
