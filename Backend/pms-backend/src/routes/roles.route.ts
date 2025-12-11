import { Router } from "express";
import { auth, requirePermission, requireRole } from "../middleware/auth.js";
import { listRoles, createRole, updateRole, deleteRole } from "../controllers/roles.controller.js";

const router = Router();

// Solo administradores/manager con permiso de management
router.use(auth, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"));

router.get("/", listRoles);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;
