import { Router } from "express";
import { auth, requirePermission, requireRole, requireManagementUser } from "../middleware/auth.js";
import { listPermissions, listPermissionModules, getRolePermissions, setRolePermissions } from "../controllers/permissions.controller.js";

const router = Router();

// Solo administradores/manager con permiso de management usando login normal (no launcher)
router.use(auth, requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"));

router.get("/", listPermissions);
router.get("/modules", listPermissionModules);
router.get("/role/:roleId", getRolePermissions);
router.put("/role/:roleId", setRolePermissions);

export default router;
