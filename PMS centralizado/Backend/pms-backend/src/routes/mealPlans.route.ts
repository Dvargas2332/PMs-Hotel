import { Router } from "express";
import { auth, requireManagementUser, requirePermission, requireRole } from "../middleware/auth.js";
import { listMealPlans, createMealPlan, updateMealPlan, deleteMealPlan } from "../controllers/mealPlans.controller.js";

const router = Router();

router.use(auth);

// Read (frontdesk users)
router.get("/", requirePermission("frontdesk.read"), listMealPlans);

// Write (management)
router.post("/", requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), createMealPlan);
router.put("/:id", requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), updateMealPlan);
router.delete("/:id", requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), deleteMealPlan);

export default router;
