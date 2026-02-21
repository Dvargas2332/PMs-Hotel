// src/routes/discounts.route.ts
import { Router } from "express";
import { createDiscount, deleteDiscount, listDiscounts, updateDiscount } from "../controllers/discounts.controller.js";

const router = Router();

router.get("/", listDiscounts);
router.post("/", createDiscount);
router.put("/:id", updateDiscount);
router.delete("/:id", deleteDiscount);

export default router;
