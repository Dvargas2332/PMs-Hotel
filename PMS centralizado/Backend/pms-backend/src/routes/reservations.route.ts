// src/routes/reservations.route.ts
import { Router } from "express";
import { auth, requirePermission, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createReservation, listReservations, listActiveCheckins, checkIn, checkOut, cancelReservation, updateReservation } from "../controllers/reservations.controller.js";
import { listDeposits, createDeposit, deleteDeposit, listPaymentMethods } from "../controllers/advanceDeposit.controller.js";
import { createReservationSchema } from "../schemas/reservations.schema.js";

const router = Router();

// Todo este router requiere estar autenticado
router.use(auth);

// Rutas RELATIVAS: el prefijo /api/reservations lo pone app.ts
router.get("/", requirePermission("frontdesk.read"), listReservations);
router.get("/active", requirePermission("frontdesk.read"), listActiveCheckins);
router.post("/", requirePermission("frontdesk.create_reservation"), validate(createReservationSchema), createReservation);
router.post("/:id/checkin", requirePermission("frontdesk.checkin"), requireRole("ADMIN", "MANAGER", "RECEPTION"), checkIn);
router.post("/:id/checkout", requirePermission("frontdesk.checkout"), requireRole("ADMIN", "MANAGER", "RECEPTION"), checkOut);
router.post("/:id/cancel", requirePermission("frontdesk.checkout"), requireRole("ADMIN", "MANAGER"), cancelReservation);
router.patch("/:id", requirePermission("frontdesk.write"), requireRole("ADMIN", "MANAGER", "RECEPTION"), updateReservation);

// Pre-pagos / depósitos
router.get("/deposits", requirePermission("frontdesk.read"), listDeposits);
router.post("/deposits", requirePermission("frontdesk.write"), createDeposit);
router.delete("/deposits/:id", requirePermission("frontdesk.write"), deleteDeposit);
router.get("/payment-methods", requirePermission("frontdesk.read"), listPaymentMethods);

export default router;
