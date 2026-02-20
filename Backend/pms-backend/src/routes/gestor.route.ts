// src/routes/gestor.route.ts
import { Router } from "express";
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  listHotels,
  createHotel,
  updateHotel,
  deleteHotel,
  getHotelAdmin,
  updateHotelAdmin,
  getHotelLauncherAdmin,
  updateHotelLauncherAdmin,
  listHotelBilling,
  createHotelBilling,
  deleteHotelBilling,
  importRooms,
  importGuests,
  importReservations,
  importRestaurantItems,
  importInventoryItems,
  importSuppliers,
  submitFormInfoFromGestor,
  getSaasConfig,
  updateSaasConfig,
} from "../controllers/gestor.controller.js";
import upload from "../middleware/upload.js";

const router = Router();

router.get("/clients", listClients);
router.post("/clients", createClient);
router.put("/clients/:id", updateClient);
router.delete("/clients/:id", deleteClient);

router.get("/hotels", listHotels);
router.post("/hotels", createHotel);
router.put("/hotels/:id", updateHotel);
router.delete("/hotels/:id", deleteHotel);
router.get("/hotels/:id/admin", getHotelAdmin);
router.put("/hotels/:id/admin", updateHotelAdmin);
router.get("/hotels/:id/launcher-admin", getHotelLauncherAdmin);
router.put("/hotels/:id/launcher-admin", updateHotelLauncherAdmin);

router.get("/hotels/:id/billing", listHotelBilling);
router.post("/hotels/:id/billing", createHotelBilling);
router.delete("/hotels/:id/billing/:paymentId", deleteHotelBilling);

router.post("/hotels/:id/import/frontdesk/rooms", upload.single("file"), importRooms);
router.post("/hotels/:id/import/frontdesk/guests", upload.single("file"), importGuests);
router.post("/hotels/:id/import/frontdesk/reservations", upload.single("file"), importReservations);
router.post("/hotels/:id/import/restaurant/pos-items", upload.single("file"), importRestaurantItems);
router.post("/hotels/:id/import/restaurant/inventory-items", upload.single("file"), importInventoryItems);
router.post("/hotels/:id/import/restaurant/suppliers", upload.single("file"), importSuppliers);

// Launcher Gestor -> Form Info (server-to-server)
router.post("/forminfo", submitFormInfoFromGestor);
router.get("/saas-config", getSaasConfig);
router.put("/saas-config", updateSaasConfig);

export default router;
