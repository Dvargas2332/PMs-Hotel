import { Router } from "express";
import { listReports, createReport, getReport } from "../controllers/report.controller.js";

const router = Router();

router.get("/", listReports);
router.post("/", createReport);
router.get("/:id", getReport);

export default router;
