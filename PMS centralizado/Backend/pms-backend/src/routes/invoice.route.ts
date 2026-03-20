import { Router } from "express";
import { listInvoices } from "../controllers/invoice.controller.js";

const router = Router();

// Historial de facturas
router.get("/", listInvoices);

export default router;

