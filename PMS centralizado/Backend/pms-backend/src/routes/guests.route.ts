// src/routes/guests.route.ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { auth, requirePermission } from "../middleware/auth.js";
import { createGuest, listGuests, updateGuest } from "../controllers/guests.controller.js";
import { createGuestSchema, updateGuestSchema } from "../schemas/guests.schema.js";

const router = Router();

// Rutas relativas; el prefijo /api/guests lo agrega app.ts
router.get("/", auth, requirePermission("frontdesk.read"), listGuests); // GET    /api/guests
router.post("/", auth, requirePermission("frontdesk.create_reservation"), validate(createGuestSchema), createGuest); // POST   /api/guests
router.put("/:id", auth, requirePermission("frontdesk.create_reservation"), validate(updateGuestSchema), updateGuest); // PUT /api/guests/:id

export default router;
