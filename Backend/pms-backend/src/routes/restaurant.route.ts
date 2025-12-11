import { Router } from "express";
import { auth, requirePermission } from "../middleware/auth.js";
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

// Todas requieren auth y permiso de acceso al módulo restaurante
router.use(auth, requirePermission("restaurant.pos.open"));

router.get("/config", getRestaurantConfig);
router.put("/config", requirePermission("restaurant.config.write"), updateRestaurantConfig);
router.get("/printers", listRestaurantPrinters);
router.post("/print", requirePermission("restaurant.print"), printRestaurantOrder);
router.post("/close", requirePermission("restaurant.shift.close"), closeShift);
router.get("/close", listCloses);
router.post("/order", requirePermission("restaurant.orders.write"), createOrUpdateOrder);
router.post("/order/close", requirePermission("restaurant.orders.close"), closeOrder);
router.get("/sections", listSections);
router.post("/sections", requirePermission("restaurant.sections.write"), createSection);
router.delete("/sections/:sectionId", requirePermission("restaurant.sections.write"), deleteSection);
router.post("/sections/:sectionId/tables", requirePermission("restaurant.sections.write"), addTableToSection);
router.delete("/sections/:sectionId/tables/:tableId", requirePermission("restaurant.sections.write"), deleteTableFromSection);
router.get("/menu", listMenu);
router.post("/menu/:sectionId", requirePermission("restaurant.menu.write"), addMenuItem);
router.delete("/menu/:sectionId/:itemId", requirePermission("restaurant.menu.write"), deleteMenuItem);

export default router;
