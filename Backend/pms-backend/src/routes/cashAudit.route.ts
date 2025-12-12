import { Router } from "express";
import { createCashAudit, listCashAudits } from "../controllers/cashAudit.controller.js";

const router = Router();

router.get("/", listCashAudits);
router.post("/", createCashAudit);

export default router;
