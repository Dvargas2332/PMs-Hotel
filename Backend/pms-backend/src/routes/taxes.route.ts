import { Router } from "express";
import { auth, requireManagementUser, requirePermission } from "../middleware/auth.js";
import { createTax, deleteTax, listTaxes, updateTax } from "../controllers/taxes.controller.js";

const router = Router();

// Read-only access for restaurant module (catalog used by items/taxes in POS)
router.get("/", auth, listTaxes);

router.use(requireManagementUser, requirePermission("management.settings.write"));

router.post("/", createTax);
router.put("/:id", updateTax);
router.delete("/:id", deleteTax);

export default router;
