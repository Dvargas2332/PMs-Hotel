// src/routes/gestor.route.ts
import { Router } from "express";
import {
  listClients,
  createClient,
  updateClient,
  listHotels,
  createHotel,
  updateHotel,
  getHotelAdmin,
  updateHotelAdmin,
  listHotelBilling,
  createHotelBilling,
  deleteHotelBilling,
  importRooms,
  importGuests,
  importReservations,
  importRestaurantItems,
  importInventoryItems,
  importSuppliers,
} from "../controllers/gestor.controller.js";
import upload from "../middleware/upload.js";

const router = Router();

router.get("/clients", listClients);
router.post("/clients", createClient);
router.put("/clients/:id", updateClient);

router.get("/hotels", listHotels);
router.post("/hotels", createHotel);
router.put("/hotels/:id", updateHotel);
router.get("/hotels/:id/admin", getHotelAdmin);
router.put("/hotels/:id/admin", updateHotelAdmin);

router.get("/hotels/:id/billing", listHotelBilling);
router.post("/hotels/:id/billing", createHotelBilling);
router.delete("/hotels/:id/billing/:paymentId", deleteHotelBilling);

router.post("/hotels/:id/import/frontdesk/rooms", upload.single("file"), importRooms);
router.post("/hotels/:id/import/frontdesk/guests", upload.single("file"), importGuests);
router.post("/hotels/:id/import/frontdesk/reservations", upload.single("file"), importReservations);
router.post("/hotels/:id/import/restaurant/pos-items", upload.single("file"), importRestaurantItems);
router.post("/hotels/:id/import/restaurant/inventory-items", upload.single("file"), importInventoryItems);
router.post("/hotels/:id/import/restaurant/suppliers", upload.single("file"), importSuppliers);

export default router;
