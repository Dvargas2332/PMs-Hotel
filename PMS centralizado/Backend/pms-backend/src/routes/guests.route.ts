// src/routes/guests.route.ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { auth, requirePermission } from "../middleware/auth.js";
import { createGuest, listGuests, updateGuest } from "../controllers/guests.controller.js";
import { createGuestSchema, updateGuestSchema } from "../schemas/guests.schema.js";

const router = Router();

// Rutas relativas; el prefijo /api/guests lo agrega app.ts
// Lectura: frontdesk O cualquier acceso a restaurante
router.get("/", auth, requirePermission("frontdesk.read", "restaurant.pos.open", "restaurant.access.pos"), listGuests);
// Escritura: frontdesk O personal de restaurante con permiso de órdenes
router.post("/", auth, requirePermission("frontdesk.create_reservation", "frontdesk.guests.write", "restaurant.orders.write"), validate(createGuestSchema), createGuest);
router.put("/:id", auth, requirePermission("frontdesk.create_reservation", "frontdesk.guests.write", "restaurant.orders.write"), validate(updateGuestSchema), updateGuest);

export default router;
