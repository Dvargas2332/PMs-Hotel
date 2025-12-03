import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  getRestaurantConfig,
  listRestaurantPrinters,
  printRestaurantOrder,
  updateRestaurantConfig,
  closeShift,
  listCloses,
  createOrUpdateOrder,
  closeOrder,
  listSections,
  createSection,
  deleteSection,
  addTableToSection,
  deleteTableFromSection,
  listMenu,
  addMenuItem,
  deleteMenuItem,
} from "../controllers/restaurant.controller.js";

const router = Router();

// Todas requieren auth
router.use(auth);

router.get("/config", getRestaurantConfig);
router.put("/config", updateRestaurantConfig);
router.get("/printers", listRestaurantPrinters);
router.post("/print", printRestaurantOrder);
router.post("/close", closeShift);
router.get("/close", listCloses);
router.post("/order", createOrUpdateOrder);
router.post("/order/close", closeOrder);
router.get("/sections", listSections);
router.post("/sections", createSection);
router.delete("/sections/:sectionId", deleteSection);
router.post("/sections/:sectionId/tables", addTableToSection);
router.delete("/sections/:sectionId/tables/:tableId", deleteTableFromSection);
router.get("/menu", listMenu);
router.post("/menu/:sectionId", addMenuItem);
router.delete("/menu/:sectionId/:itemId", deleteMenuItem);

export default router;
