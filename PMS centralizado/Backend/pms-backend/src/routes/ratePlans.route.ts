import { Router } from "express";
import { auth, requireManagementUser, requirePermission, requireRole } from "../middleware/auth.js";
import { listRatePlans, createRatePlan, updateRatePlan, deleteRatePlan } from "../controllers/ratePlans.controller.js";

const router = Router();

router.use(auth);

// Read (frontdesk users)
router.get("/", requirePermission("frontdesk.read"), listRatePlans);

// Write (management)
router.post("/", requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), createRatePlan);
router.put("/:id", requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), updateRatePlan);
router.delete("/:id", requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), deleteRatePlan);

export default router;
