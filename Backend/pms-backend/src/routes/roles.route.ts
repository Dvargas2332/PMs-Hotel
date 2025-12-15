import { Router } from "express";
import { auth, requireManagementUser } from "../middleware/auth.js";
import { listRoles } from "../controllers/roles.controller.js";

const router = Router();

// Solo usuarios de management autenticados (se simplifica para desarrollo).
router.use(auth, requireManagementUser);

// Roles predefinidos: solo lectura desde el management
router.get("/", listRoles);

export default router;

