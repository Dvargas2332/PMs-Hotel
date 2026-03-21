import { Router } from "express";
import { createAuditLog, listAuditLogs } from "../controllers/audit.controller.js";

const router = Router();

router.get("/", listAuditLogs);
router.post("/", createAuditLog);

export default router;
