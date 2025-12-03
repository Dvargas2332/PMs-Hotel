// src/routes/hotel.route.ts
import { Router } from "express";
import { auth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getHotel, updateHotel, listRooms, listGuests } from "../controllers/hotel.controller.js";
import { updateHotelSchema } from "../schemas/hotel.schema.js";

const router = Router();

// Info del hotel
router.get("/", auth, getHotel);
router.put("/", auth, requireRole("ADMIN", "MANAGER"), validate(updateHotelSchema), updateHotel);

// Recursos anidados por hotel
router.get("/:hotelId/rooms", auth, listRooms);
router.get("/:hotelId/guests", auth, listGuests);

export default router;
