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
  searchCabysFromHacienda,
  getCabysFromHacienda,
  syncCabysFromHacienda,
} from "../controllers/einvoicing.catalog.controller.js";
import { importEInvoicingXml } from "../controllers/einvoicing.import.controller.js";
import {
  cancelEInvoicingDocument,
  refreshEInvoicingDocumentStatus,
  submitEInvoicingDocument,
} from "../controllers/einvoicing.hacienda.controller.js";
import {
  issueNote,
  listNotesForDoc,
} from "../controllers/einvoicing.creditdebit.controller.js";
import { sendDocumentByEmail } from "../controllers/einvoicing.email.controller.js";
import { getDocumentHtml, getDocumentPdf } from "../controllers/einvoicing.print.controller.js";

const router = Router();

// Acceso al módulo
router.use(auth, requirePermission("einvoicing.access"));

// Requisitos y configuración
router.get("/requirements", listEInvoicingRequirements);
router.put("/requirements", requirePermission("einvoicing.settings.write"), replaceEInvoicingRequirements);
router.get("/config", getEInvoicingConfig);
router.put("/config", requirePermission("einvoicing.settings.write"), updateEInvoicingConfig);

// Documentos — listado y detalle
router.get("/documents", listEInvoicingDocuments);
router.get("/documents/:id", getEInvoicingDocument);

// Documentos — representación gráfica (HTML y PDF requeridos por Hacienda)
router.get("/documents/:id/html", getDocumentHtml);
router.get("/documents/:id/pdf", getDocumentPdf);

// Documentos — operaciones
router.post("/documents/import-xml", requirePermission("einvoicing.issue"), importEInvoicingXml);
router.post("/documents/:id/submit", requirePermission("einvoicing.issue"), submitEInvoicingDocument);
router.post("/documents/:id/refresh", requirePermission("einvoicing.issue"), refreshEInvoicingDocumentStatus);
router.post("/documents/:id/cancel", requirePermission("einvoicing.cancel"), cancelEInvoicingDocument);
router.post("/documents/:id/send-email", requirePermission("einvoicing.issue"), sendDocumentByEmail);

// Notas de Crédito (NC) y Notas de Débito (ND)
// POST body: { referenceDocId, docType: "NC"|"ND", reason, reasonCode?, items?, receiver? }
router.post("/notes/issue", requirePermission("einvoicing.issue"), issueNote);
router.get("/notes/:docId", requirePermission("einvoicing.issue"), listNotesForDoc);

// Acknowledgements
router.get("/acks", requirePermission("einvoicing.issue"), listEInvoicingAcknowledgements);
router.get("/acks/:id", requirePermission("einvoicing.issue"), getEInvoicingAcknowledgement);
router.post("/acks", requirePermission("einvoicing.issue"), createEInvoicingAcknowledgement);

// Integración Frontdesk
// body: { invoiceId, docType: "FE"|"TE", receiver?, situation? }
router.post("/frontdesk/issue", requirePermission("einvoicing.issue"), issueFrontdeskElectronicDoc);
router.get("/frontdesk/invoice/:invoiceId", requirePermission("einvoicing.issue"), listFrontdeskElectronicDocs);

// Integración Restaurante
// body: { restaurantOrderId, docType: "FE"|"TE", receiver?, situation? }
router.post("/restaurant/issue", requirePermission("einvoicing.issue"), issueRestaurantElectronicDoc);

// Catálogos CABYS — local (por hotel)
router.get("/cabys", listCabys);
router.post("/cabys/import", requirePermission("einvoicing.settings.write"), importCabys);

// Catálogos CABYS — directo desde API Hacienda CR
router.get("/cabys/hacienda", searchCabysFromHacienda);
router.get("/cabys/hacienda/:codigo", getCabysFromHacienda);
router.post("/cabys/sync", requirePermission("einvoicing.settings.write"), syncCabysFromHacienda);

// Catálogos FE oficiales (por hotel)
router.get("/catalogs/:catalog", listCatalogEntries);
router.post("/catalogs/:catalog/import", requirePermission("einvoicing.settings.write"), importCatalogEntries);

export default router;
