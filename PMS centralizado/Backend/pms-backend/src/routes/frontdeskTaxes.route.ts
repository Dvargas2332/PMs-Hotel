import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { listTaxes } from "../controllers/taxes.controller.js";

const router = Router();

// Frontdesk-only read access to taxes catalog
router.get("/", auth, listTaxes);

export default router;
