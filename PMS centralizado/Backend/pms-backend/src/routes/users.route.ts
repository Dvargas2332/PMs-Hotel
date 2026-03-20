// src/routes/users.route.ts

import { Router } from "express";
import { auth, requirePermission, requireRole, requireManagementUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { resetPasswordSchema } from "../schemas/user.schema.js";
import { resetUserPassword } from "../controllers/users.controller.js";

const router = Router();

// Solo administradores/manager con permiso de management usando login normal (no launcher)
router.use(auth, requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"));

// POST /api/users/:id/reset-password
router.post("/:id/reset-password", validate(resetPasswordSchema), resetUserPassword);

export default router;
