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
  saveSectionLayout,
  listSectionObjects,
  createSectionObject,
  updateSectionObject,
  deleteSectionObject,
  listMenu,
  addMenuItem,
  deleteMenuItem,
  listMenus,
  createMenu,
  updateMenu,
  deleteMenu,
  listMenuItems,
  addMenuItemToMenu,
  deleteMenuItemFromMenu,
  listMenuEntries,
  addMenuEntries,
  deleteMenuEntry,
  listSectionMenuAssignments,
  createSectionMenuAssignment,
  updateSectionMenuAssignment,
  deleteSectionMenuAssignment,
  listFamilies,
  createFamily,
  deleteFamily,
  updateFamily,
  listSubFamilies,
  createSubFamily,
  deleteSubFamily,
  listSubSubFamilies,
  createSubSubFamily,
  deleteSubSubFamily,
  listItems,
  createItems,
  updateItem,
  deleteItem,
  listInventory,
  createInventoryItem,
  deleteInventoryItem,
  listRecipes,
  createRecipeLine,
  deleteRecipeLine,
} from "../controllers/restaurant.controller.js";

const router = Router();

// Todas requieren auth. Los permisos se aplican por endpoint.
router.use(auth);

router.get("/config", requirePermission("restaurant.pos.open", "restaurant.config.write"), getRestaurantConfig);
router.put("/config", requirePermission("restaurant.config.write"), updateRestaurantConfig);
router.get("/taxes", requirePermission("restaurant.pos.open", "restaurant.config.write"), getRestaurantTaxes);
router.put("/taxes", requirePermission("restaurant.config.write"), updateRestaurantTaxes);
router.get("/payments", requirePermission("restaurant.pos.open", "restaurant.config.write"), getRestaurantPayments);
router.put("/payments", requirePermission("restaurant.config.write"), updateRestaurantPayments);
router.get("/general", requirePermission("restaurant.pos.open", "restaurant.config.write"), getRestaurantGeneral);
router.put("/general", requirePermission("restaurant.config.write"), updateRestaurantGeneral);
router.get("/billing", requirePermission("restaurant.pos.open", "restaurant.config.write"), getRestaurantBilling);
router.put("/billing", requirePermission("restaurant.config.write"), updateRestaurantBilling);
router.get("/printers", requirePermission("restaurant.pos.open", "restaurant.config.write"), listRestaurantPrinters);
router.post("/print", requirePermission("restaurant.print"), printRestaurantOrder);
router.post("/close", requirePermission("restaurant.shift.close"), closeShift);
router.get("/close", requirePermission("restaurant.pos.open", "restaurant.shift.close"), listCloses);
router.get("/stats", requirePermission("restaurant.pos.open"), getRestaurantStats);
router.get("/orders", requirePermission("restaurant.pos.open"), listOrders);
router.post("/order", requirePermission("restaurant.orders.write"), createOrUpdateOrder);
router.post("/order/close", requirePermission("restaurant.orders.close"), closeOrder);
router.post("/order/charge", requirePermission("restaurant.orders.close"), closeOrder);
router.post("/order/move", requirePermission("restaurant.orders.write"), moveOrderTable);
router.post("/order/reprint", requirePermission("restaurant.print"), reprintOrder);
router.post("/order/void-invoice", requirePermission("einvoicing.issue"), voidRestaurantInvoice);
router.get("/kds", requirePermission("restaurant.pos.open"), listKds);
router.patch("/kds/:orderItemId", requirePermission("restaurant.orders.write"), updateKdsItem);
router.get("/sections", requirePermission("restaurant.pos.open", "restaurant.sections.write"), listSections);
router.post("/sections", requirePermission("restaurant.sections.write"), createSection);
router.delete("/sections/:sectionId", requirePermission("restaurant.sections.write"), deleteSection);
router.post("/sections/:sectionId/tables", requirePermission("restaurant.sections.write"), addTableToSection);
router.delete("/sections/:sectionId/tables/:tableId", requirePermission("restaurant.sections.write"), deleteTableFromSection);
router.patch("/sections/:sectionId/tables/:tableId/position", requirePermission("restaurant.sections.write"), updateTablePosition);
router.put("/sections/:sectionId/layout", requirePermission("restaurant.sections.write"), saveSectionLayout);
router.get("/sections/:sectionId/objects", requirePermission("restaurant.pos.open", "restaurant.sections.write"), listSectionObjects);
router.post("/sections/:sectionId/objects", requirePermission("restaurant.sections.write"), createSectionObject);
router.patch("/sections/:sectionId/objects/:objectId", requirePermission("restaurant.sections.write"), updateSectionObject);
router.delete("/sections/:sectionId/objects/:objectId", requirePermission("restaurant.sections.write"), deleteSectionObject);
router.get("/menu", requirePermission("restaurant.pos.open", "restaurant.menu.write"), listMenu);
router.post("/menu/:sectionId", requirePermission("restaurant.menu.write"), addMenuItem);
router.delete("/menu/:sectionId/:itemId", requirePermission("restaurant.menu.write"), deleteMenuItem);

// Nuevo: Menús con horarios por sección
router.get("/menus", requirePermission("restaurant.menu.write"), listMenus);
router.post("/menus", requirePermission("restaurant.menu.write"), createMenu);
router.patch("/menus/:menuId", requirePermission("restaurant.menu.write"), updateMenu);
router.delete("/menus/:menuId", requirePermission("restaurant.menu.write"), deleteMenu);
router.get("/menus/:menuId/items", requirePermission("restaurant.menu.write"), listMenuItems);
router.post("/menus/:menuId/items", requirePermission("restaurant.menu.write"), addMenuItemToMenu);
router.delete("/menus/:menuId/items/:itemId", requirePermission("restaurant.menu.write"), deleteMenuItemFromMenu);
router.get("/menus/:menuId/entries", requirePermission("restaurant.menu.write"), listMenuEntries);
router.post("/menus/:menuId/entries", requirePermission("restaurant.menu.write"), addMenuEntries);
router.delete("/menus/:menuId/entries/:entryId", requirePermission("restaurant.menu.write"), deleteMenuEntry);
router.get("/sections/:sectionId/menus", requirePermission("restaurant.menu.write"), listSectionMenuAssignments);
router.post("/sections/:sectionId/menus", requirePermission("restaurant.menu.write"), createSectionMenuAssignment);
router.patch("/sections/:sectionId/menus/:assignmentId", requirePermission("restaurant.menu.write"), updateSectionMenuAssignment);
router.delete("/sections/:sectionId/menus/:assignmentId", requirePermission("restaurant.menu.write"), deleteSectionMenuAssignment);

router.get("/families", requirePermission("restaurant.families.write"), listFamilies);
router.post("/families", requirePermission("restaurant.families.write"), createFamily);
router.patch("/families/:id", requirePermission("restaurant.families.write"), updateFamily);
router.delete("/families/:id", requirePermission("restaurant.families.write"), deleteFamily);

router.get("/subfamilies", requirePermission("restaurant.families.write"), listSubFamilies);
router.post("/subfamilies", requirePermission("restaurant.families.write"), createSubFamily);
router.delete("/subfamilies/:id", requirePermission("restaurant.families.write"), deleteSubFamily);

router.get("/subsubfamilies", requirePermission("restaurant.families.write"), listSubSubFamilies);
router.post("/subsubfamilies", requirePermission("restaurant.families.write"), createSubSubFamily);
router.delete("/subsubfamilies/:id", requirePermission("restaurant.families.write"), deleteSubSubFamily);

router.get("/items", requirePermission("restaurant.items.write"), listItems);
router.post("/items", requirePermission("restaurant.items.write"), createItems);
router.patch("/items/:id", requirePermission("restaurant.items.write"), updateItem);
router.delete("/items/:id", requirePermission("restaurant.items.write"), deleteItem);

router.get("/inventory", requirePermission("restaurant.inventory.write"), listInventory);
router.post("/inventory", requirePermission("restaurant.inventory.write"), createInventoryItem);
router.delete("/inventory/:id", requirePermission("restaurant.inventory.write"), deleteInventoryItem);

router.get("/recipes", requirePermission("restaurant.recipes.write"), listRecipes);
router.post("/recipes", requirePermission("restaurant.recipes.write"), createRecipeLine);
router.delete("/recipes/:id", requirePermission("restaurant.recipes.write"), deleteRecipeLine);

export default router;
