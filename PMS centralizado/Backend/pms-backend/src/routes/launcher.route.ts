// src/routes/launcher.route.ts

import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { auth, requireManagementUser } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  launcherLoginSchema,
  launcherAccountCreateSchema,
  launcherAccountUpdateSchema,
} from "../schemas/launcher.schema.js";
import {
  launcherLogin,
  listLauncherAccounts,
  createLauncherAccount,
  updateLauncherAccount,
  deleteLauncherAccount,
} from "../controllers/launcher.controller.js";

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "launcher-login" });

// Login del launcher (no requiere auth previo)
router.post("/login", loginLimiter, validate(launcherLoginSchema), launcherLogin);

// Rutas de gestión de cuentas de launcher (management) - solo usuarios normales, no launcher.
// Simplificado: solo verificamos que sea un usuario de management autenticado.
router.use(auth, requireManagementUser);

router.get("/", listLauncherAccounts);
router.post("/", validate(launcherAccountCreateSchema), createLauncherAccount);
router.put("/:id", validate(launcherAccountUpdateSchema), updateLauncherAccount);
router.delete("/:id", deleteLauncherAccount);

export default router;
