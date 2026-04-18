import { Router } from "express";
import { requirePermission } from "../middleware/auth.js";
import {
  listInvoices,
  getInvoice,
  addInvoiceItem,
  removeInvoiceItem,
  recordPayment,
  removePayment,
  updateInvoiceStatus,
} from "../controllers/invoice.controller.js";

const router = Router();

router.get("/",                                    requirePermission("frontdesk.read"),  listInvoices);
router.get("/:id",                                 requirePermission("frontdesk.read"),  getInvoice);
router.post("/:id/items",                          requirePermission("frontdesk.write"), addInvoiceItem);
router.delete("/:id/items/:itemId",                requirePermission("frontdesk.write"), removeInvoiceItem);
router.post("/:id/payments",                       requirePermission("frontdesk.write"), recordPayment);
router.delete("/:id/payments/:paymentId",          requirePermission("frontdesk.write"), removePayment);
router.patch("/:id/status",                        requirePermission("frontdesk.write"), updateInvoiceStatus);

export default router;
