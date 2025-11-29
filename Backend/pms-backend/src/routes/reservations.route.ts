import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { createReservationSchema } from "../schemas/reservations.schema.js";
import { createReservation, listReservations } from "../controllers/reservations.controller.js";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/auth.js";
import { checkIn, checkOut, cancelReservation } from "../controllers/reservations.controller.js";

const r = Router();
r.get("/reservations", listReservations);
r.post("/reservations", validate(createReservationSchema), createReservation);
r.post("/reservations/:id/checkin", auth, requireRole("ADMIN","MANAGER","RECEPTION"), checkIn);
r.post("/reservations/:id/checkout", auth, requireRole("ADMIN","MANAGER","RECEPTION"), checkOut);
r.post("/reservations/:id/cancel", auth, requireRole("ADMIN","MANAGER"), cancelReservation);

export default r;