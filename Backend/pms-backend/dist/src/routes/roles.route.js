import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { listRoles, createRole, updateRole, deleteRole } from "../controllers/roles.controller.js";
const router = Router();
router.get("/", auth, listRoles);
router.post("/", auth, createRole);
router.put("/:id", auth, updateRole);
router.delete("/:id", auth, deleteRole);
export default router;
