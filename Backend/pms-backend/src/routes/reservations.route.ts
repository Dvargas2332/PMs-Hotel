// src/routes/reservations.route.ts
import { Router } from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {  createReservation, listReservations, checkIn, checkOut, cancelReservation,
} from "../controllers/reservations.controller.js";
import { createReservationSchema } from "../schemas/reservations.schema.js";

const router = Router();

// Todo este router requiere estar autenticado
router.use(auth);

// Rutas RELATIVAS: el prefijo /api/reservations lo pone app.ts
router.get("/", listReservations);                                            // GET    /api/reservations
router.post("/", validate(createReservationSchema), createReservation);       // POST   /api/reservations
router.post("/:id/checkin",  requireRole("ADMIN","MANAGER","RECEPTION"), checkIn);   // POST /api/reservations/:id/checkin
router.post("/:id/checkout", requireRole("ADMIN","MANAGER","RECEPTION"), checkOut);  // POST /api/reservations/:id/checkout
router.post("/:id/cancel",   requireRole("ADMIN","MANAGER"), cancelReservation);     // POST /api/reservations/:id/cancel

export default router;
