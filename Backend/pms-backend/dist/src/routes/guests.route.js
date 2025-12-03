// src/routes/guests.route.ts
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { auth } from "../middleware/auth.js";
import { createGuest, listGuests, updateGuest } from "../controllers/guests.controller.js";
import { createGuestSchema, updateGuestSchema } from "../schemas/guests.schema.js";
const router = Router();
// OJO: rutas relativas; el prefijo /api/guests lo pondrá app.ts
router.get("/", auth, listGuests); // GET    /api/guests
router.post("/", auth, validate(createGuestSchema), createGuest); // POST   /api/guests
router.put("/:id", auth, validate(updateGuestSchema), updateGuest); // PUT /api/guests/:id
export default router;
