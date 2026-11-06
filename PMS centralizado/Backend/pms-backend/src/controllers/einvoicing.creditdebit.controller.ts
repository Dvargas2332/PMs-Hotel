/**
 * Controlador para emisión de Notas de Crédito (NC, tipo 03) y Notas de Débito (ND, tipo 02)
 * Hacienda CR v4.4 — referencia obligatoria al documento electrónico original (FE/TE).
 *
 * La lógica de negocio vive en services/einvoicing.notes.ts; este archivo es solo un
 * adaptador Express.
 */

import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import {
  createCreditDebitNote,
  NoteCreationError,
} from "../services/einvoicing.notes.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

/**
 * POST /einvoicing/notes/issue
 * Body: { referenceDocId, docType: "NC"|"ND", reason, reasonCode, items?, receiver? }
 */
export async function issueNote(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { referenceDocId, docType, reason, reasonCode, items: bodyItems, receiver } = (req.body || {}) as {
    referenceDocId?: string;
    docType?: "NC" | "ND";
    reason?: string;
    reasonCode?: string;
    items?: any[];
    receiver?: any;
  };

  if (!referenceDocId) return res.status(400).json({ message: "referenceDocId requerido" });

  try {
    const doc = await createCreditDebitNote({
      hotelId,
      // @ts-ignore
      actorId: req.user?.sub,
      referenceDocId,
      docType: docType || "NC",
      reason: reason || "",
      reasonCode,
      items: bodyItems,
      receiver,
    });
    return res.json(doc);
  } catch (err) {
    if (err instanceof NoteCreationError) {
      return res.status(err.statusCode).json({ message: err.message, detail: err.detail });
    }
    console.error("[issueNote] error inesperado:", err);
    return res.status(500).json({ message: "Error al emitir la nota" });
  }
}

/**
 * GET /einvoicing/notes/:docId
 * Lista las NC/ND emitidas sobre un documento original.
 */
export async function listNotesForDoc(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const docId = String((req.params as any)?.docId || "");
  if (!docId) return res.status(400).json({ message: "docId requerido" });

  // @ts-ignore
  const notes = await (prisma.eInvoicingDocument as any).findMany({
    where: { hotelId, referenceDocId: docId },
    orderBy: { createdAt: "desc" },
  });
  return res.json(notes);
}
