// src/routes/hotel.route.ts
import { Router } from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getHotel, updateHotel, listRooms, listGuests, getCurrency, updateCurrency } from "../controllers/hotel.controller.js";
import { updateHotelSchema } from "../schemas/hotel.schema.js";

const router = Router();

// Info del hotel
router.get("/", auth, getHotel);
router.put("/", auth, requireRole("ADMIN", "MANAGER"), validate(updateHotelSchema), updateHotel);
router.get("/currency", auth, getCurrency);
router.put("/currency", auth, requireRole("ADMIN", "MANAGER"), updateCurrency);

// Recursos anidados por hotel
router.get("/:hotelId/rooms", auth, listRooms);
router.get("/:hotelId/guests", auth, listGuests);

export default router;
