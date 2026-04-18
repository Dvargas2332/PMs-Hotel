import { Router } from "express";
import { requirePermission } from "../middleware/auth.js";
import { dailyFlash, occupancyRange, revenueRange, arrivalsDepartures, housekeepingReport } from "../controllers/reports.controller.js";

const router = Router();

router.get("/daily",                requirePermission("frontdesk.read"), dailyFlash);
router.get("/occupancy",            requirePermission("frontdesk.read"), occupancyRange);
router.get("/revenue",              requirePermission("frontdesk.read"), revenueRange);
router.get("/arrivals-departures",  requirePermission("frontdesk.read"), arrivalsDepartures);
router.get("/housekeeping",         requirePermission("frontdesk.read"), housekeepingReport);

export default router;
