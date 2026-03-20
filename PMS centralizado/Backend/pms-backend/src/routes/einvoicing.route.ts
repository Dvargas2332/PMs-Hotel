import { Router } from "express";
import { requirePermission, auth } from "../middleware/auth.js";
import {
  getEInvoicingConfig,
  getEInvoicingDocument,
  listEInvoicingDocuments,
  listEInvoicingRequirements,
  replaceEInvoicingRequirements,
  updateEInvoicingConfig,
} from "../controllers/einvoicing.controller.js";
import {
  issueFrontdeskElectronicDoc,
  listFrontdeskElectronicDocs,
} from "../controllers/einvoicing.frontdesk.controller.js";
import { issueRestaurantElectronicDoc } from "../controllers/einvoicing.restaurant.controller.js";
import {
  createEInvoicingAcknowledgement,
  getEInvoicingAcknowledgement,
  listEInvoicingAcknowledgements,
} from "../controllers/einvoicing.ack.controller.js";
import {
  importCabys,
  importCatalogEntries,
  listCabys,
  listCatalogEntries,
} from "../controllers/einvoicing.catalog.controller.js";
import { importEInvoicingXml } from "../controllers/einvoicing.import.controller.js";
import {
  cancelEInvoicingDocument,
  refreshEInvoicingDocumentStatus,
  submitEInvoicingDocument,
} from "../controllers/einvoicing.hacienda.controller.js";

const router = Router();

// Access to the module
router.use(auth, requirePermission("einvoicing.access"));

router.get("/requirements", listEInvoicingRequirements);
router.get("/documents", listEInvoicingDocuments);
router.get("/documents/:id", getEInvoicingDocument);
router.post("/documents/import-xml", requirePermission("einvoicing.issue"), importEInvoicingXml);
router.post("/documents/:id/submit", requirePermission("einvoicing.issue"), submitEInvoicingDocument);
router.post("/documents/:id/refresh", requirePermission("einvoicing.issue"), refreshEInvoicingDocumentStatus);
router.post("/documents/:id/cancel", requirePermission("einvoicing.cancel"), cancelEInvoicingDocument);
router.get("/acks", requirePermission("einvoicing.issue"), listEInvoicingAcknowledgements);
router.get("/acks/:id", requirePermission("einvoicing.issue"), getEInvoicingAcknowledgement);
router.post("/acks", requirePermission("einvoicing.issue"), createEInvoicingAcknowledgement);

// Editing requirements/config should be limited by permission
router.put(
  "/requirements",
  requirePermission("einvoicing.settings.write"),
  replaceEInvoicingRequirements
);

router.get("/config", getEInvoicingConfig);
router.put(
  "/config",
  requirePermission("einvoicing.settings.write"),
  updateEInvoicingConfig
);

// Frontdesk integration
router.post("/frontdesk/issue", requirePermission("einvoicing.issue"), issueFrontdeskElectronicDoc);
router.get("/frontdesk/invoice/:invoiceId", requirePermission("einvoicing.issue"), listFrontdeskElectronicDocs);

// Restaurant integration
router.post("/restaurant/issue", requirePermission("einvoicing.issue"), issueRestaurantElectronicDoc);

// Catalogs (CABYS + FE catalogs). Stored per-hotel to avoid cross-hotel mixing.
router.get("/cabys", listCabys);
router.post("/cabys/import", requirePermission("einvoicing.settings.write"), importCabys);
router.get("/catalogs/:catalog", listCatalogEntries);
router.post("/catalogs/:catalog/import", requirePermission("einvoicing.settings.write"), importCatalogEntries);

export default router;
