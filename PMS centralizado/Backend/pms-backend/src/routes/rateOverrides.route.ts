import { Router } from "express";
import { auth, requireManagementUser, requirePermission, requireRole } from "../middleware/auth.js";
import { listRateOverrides, upsertRateOverride, bulkUpsertRateOverrides, deleteRateOverride } from "../controllers/rateOverrides.controller.js";

const router = Router();
router.use(auth);

router.get("/",        requirePermission("frontdesk.read"), listRateOverrides);
router.put("/",        requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN","MANAGER"), upsertRateOverride);
router.put("/bulk",    requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN","MANAGER"), bulkUpsertRateOverrides);
router.delete("/:id",  requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN","MANAGER"), deleteRateOverride);

export default router;
