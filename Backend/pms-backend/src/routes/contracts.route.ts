import { Router } from "express";
import { auth, requireManagementUser, requirePermission, requireRole } from "../middleware/auth.js";
import { listContracts, createContract, updateContract, deleteContract } from "../controllers/contracts.controller.js";

const router = Router();

router.use(auth);

// Read (management)
router.get("/", requirePermission("frontdesk.read"), listContracts);

// Write (management)
router.post("/", requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), createContract);
router.put("/:id", requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), updateContract);
router.delete("/:id", requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), deleteContract);

export default router;
