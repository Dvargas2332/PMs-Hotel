import { Router } from "express";
import { auth, requireManagementUser } from "../middleware/auth.js";
import { listRoles, createRole, updateRole, deleteRole } from "../controllers/roles.controller.js";

const router = Router();

// Solo usuarios de management autenticados (se simplifica para desarrollo).
router.use(auth, requireManagementUser);

// Roles desde management
router.get("/", listRoles);
router.post("/", createRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;
