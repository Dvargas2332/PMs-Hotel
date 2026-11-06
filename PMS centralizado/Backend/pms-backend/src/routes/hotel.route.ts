// src/routes/hotel.route.ts
import { Router } from "express";
import { auth, requirePermission, requireRole, requireManagementUser } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getHotel, updateHotel, getHotelCompany, updateHotelCompany, listRooms, listGuests, getCurrency, updateCurrency } from "../controllers/hotel.controller.js";
import { updateHotelSchema } from "../schemas/hotel.schema.js";

const router = Router();

// Info del hotel
router.get("/", auth, requirePermission("frontdesk.read"), getHotel);
router.put("/", auth, requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), validate(updateHotelSchema), updateHotel);

// Empresa (SaasClient) asociada al hotel
router.get("/company", auth, requireManagementUser, requirePermission("management.settings.write"), getHotelCompany);
router.put("/company", auth, requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), updateHotelCompany);

router.get("/currency", auth, requirePermission("frontdesk.read"), getCurrency);
router.put("/currency", auth, requireManagementUser, requirePermission("management.settings.write"), requireRole("ADMIN", "MANAGER"), updateCurrency);

// Recursos anidados por hotel
router.get("/:hotelId/rooms", auth, requirePermission("frontdesk.read"), listRooms);
router.get("/:hotelId/guests", auth, requirePermission("frontdesk.read"), listGuests);

export default router;
