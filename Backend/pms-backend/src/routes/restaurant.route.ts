import { Router } from "express";
import { auth, requirePermission } from "../middleware/auth.js";
import {
  getRestaurantConfig,
  getRestaurantTaxes,
  updateRestaurantTaxes,
  getRestaurantPayments,
  updateRestaurantPayments,
  getRestaurantGeneral,
  updateRestaurantGeneral,
  getRestaurantBilling,
  updateRestaurantBilling,
  listRestaurantPrinters,
  printRestaurantOrder,
  updateRestaurantConfig,
  getRestaurantStats,
  closeShift,
  listCloses,
  listOrders,
  listKds,
  updateKdsItem,
  createOrUpdateOrder,
  closeOrder,
  moveOrderTable,
  reprintOrder,
  voidRestaurantInvoice,
  listSections,
  createSection,
  deleteSection,
  addTableToSection,
  deleteTableFromSection,
  updateTablePosition,
  listSectionObjects,
  createSectionObject,
  updateSectionObject,
  deleteSectionObject,
  listMenu,
  addMenuItem,
  deleteMenuItem,
  listFamilies,
  createFamily,
  deleteFamily,
  listSubFamilies,
  createSubFamily,
  deleteSubFamily,
  listSubSubFamilies,
  createSubSubFamily,
  deleteSubSubFamily,
  listItems,
  createItems,
  deleteItem,
  listInventory,
  createInventoryItem,
  deleteInventoryItem,
  listRecipes,
  createRecipeLine,
  deleteRecipeLine,
} from "../controllers/restaurant.controller.js";

const router = Router();

// Todas requieren auth y permiso de acceso al módulo restaurante
router.use(auth, requirePermission("restaurant.pos.open"));

router.get("/config", getRestaurantConfig);
router.put("/config", requirePermission("restaurant.config.write"), updateRestaurantConfig);
router.get("/taxes", requirePermission("restaurant.config.write"), getRestaurantTaxes);
router.put("/taxes", requirePermission("restaurant.config.write"), updateRestaurantTaxes);
router.get("/payments", requirePermission("restaurant.config.write"), getRestaurantPayments);
router.put("/payments", requirePermission("restaurant.config.write"), updateRestaurantPayments);
router.get("/general", requirePermission("restaurant.config.write"), getRestaurantGeneral);
router.put("/general", requirePermission("restaurant.config.write"), updateRestaurantGeneral);
router.get("/billing", requirePermission("restaurant.config.write"), getRestaurantBilling);
router.put("/billing", requirePermission("restaurant.config.write"), updateRestaurantBilling);
router.get("/printers", listRestaurantPrinters);
router.post("/print", requirePermission("restaurant.print"), printRestaurantOrder);
router.post("/close", requirePermission("restaurant.shift.close"), closeShift);
router.get("/close", listCloses);
router.get("/stats", getRestaurantStats);
router.get("/orders", listOrders);
router.post("/order", requirePermission("restaurant.orders.write"), createOrUpdateOrder);
router.post("/order/close", requirePermission("restaurant.orders.close"), closeOrder);
router.post("/order/charge", requirePermission("restaurant.orders.close"), closeOrder);
router.post("/order/move", requirePermission("restaurant.orders.write"), moveOrderTable);
router.post("/order/reprint", requirePermission("restaurant.print"), reprintOrder);
router.post("/order/void-invoice", requirePermission("einvoicing.issue"), voidRestaurantInvoice);
router.get("/kds", listKds);
router.patch("/kds/:orderItemId", requirePermission("restaurant.orders.write"), updateKdsItem);
router.get("/sections", listSections);
router.post("/sections", requirePermission("restaurant.sections.write"), createSection);
router.delete("/sections/:sectionId", requirePermission("restaurant.sections.write"), deleteSection);
router.post("/sections/:sectionId/tables", requirePermission("restaurant.sections.write"), addTableToSection);
router.delete("/sections/:sectionId/tables/:tableId", requirePermission("restaurant.sections.write"), deleteTableFromSection);
router.patch("/sections/:sectionId/tables/:tableId/position", requirePermission("restaurant.sections.write"), updateTablePosition);
router.get("/sections/:sectionId/objects", listSectionObjects);
router.post("/sections/:sectionId/objects", requirePermission("restaurant.sections.write"), createSectionObject);
router.patch("/sections/:sectionId/objects/:objectId", requirePermission("restaurant.sections.write"), updateSectionObject);
router.delete("/sections/:sectionId/objects/:objectId", requirePermission("restaurant.sections.write"), deleteSectionObject);
router.get("/menu", listMenu);
router.post("/menu/:sectionId", requirePermission("restaurant.menu.write"), addMenuItem);
router.delete("/menu/:sectionId/:itemId", requirePermission("restaurant.menu.write"), deleteMenuItem);

router.get("/families", requirePermission("restaurant.families.write"), listFamilies);
router.post("/families", requirePermission("restaurant.families.write"), createFamily);
router.delete("/families/:id", requirePermission("restaurant.families.write"), deleteFamily);

router.get("/subfamilies", requirePermission("restaurant.families.write"), listSubFamilies);
router.post("/subfamilies", requirePermission("restaurant.families.write"), createSubFamily);
router.delete("/subfamilies/:id", requirePermission("restaurant.families.write"), deleteSubFamily);

router.get("/subsubfamilies", requirePermission("restaurant.families.write"), listSubSubFamilies);
router.post("/subsubfamilies", requirePermission("restaurant.families.write"), createSubSubFamily);
router.delete("/subsubfamilies/:id", requirePermission("restaurant.families.write"), deleteSubSubFamily);

router.get("/items", requirePermission("restaurant.items.write"), listItems);
router.post("/items", requirePermission("restaurant.items.write"), createItems);
router.delete("/items/:id", requirePermission("restaurant.items.write"), deleteItem);

router.get("/inventory", requirePermission("restaurant.inventory.write"), listInventory);
router.post("/inventory", requirePermission("restaurant.inventory.write"), createInventoryItem);
router.delete("/inventory/:id", requirePermission("restaurant.inventory.write"), deleteInventoryItem);

router.get("/recipes", requirePermission("restaurant.recipes.write"), listRecipes);
router.post("/recipes", requirePermission("restaurant.recipes.write"), createRecipeLine);
router.delete("/recipes/:id", requirePermission("restaurant.recipes.write"), deleteRecipeLine);

export default router;
