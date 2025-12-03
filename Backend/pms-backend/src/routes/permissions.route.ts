import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { listPermissions, getRolePermissions, setRolePermissions } from "../controllers/permissions.controller.js";

const router = Router();

router.get("/", auth, listPermissions);
router.get("/role/:roleId", auth, getRolePermissions);
router.put("/role/:roleId", auth, setRolePermissions);

export default router;
