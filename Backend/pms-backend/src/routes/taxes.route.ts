import { Router } from "express";
import { requireManagementUser, requirePermission } from "../middleware/auth.js";
import { createTax, deleteTax, listTaxes, updateTax } from "../controllers/taxes.controller.js";

const router = Router();

router.use(requireManagementUser, requirePermission("management.settings.write"));

router.get("/", listTaxes);
router.post("/", createTax);
router.put("/:id", updateTax);
router.delete("/:id", deleteTax);

export default router;
