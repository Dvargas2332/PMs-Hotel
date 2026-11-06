import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { issueRestaurantDoc } from "../services/restaurant.einvoice.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

/**
 * Emisión manual/reemisión del comprobante de una venta de restaurante.
 * El XML, los medios de pago, el cliente y el consecutivo los resuelve el
 * servicio compartido (el mismo que usa el cierre de la orden).
 */
export async function issueRestaurantElectronicDoc(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const { restaurantOrderId, docType, receiver, situation } = (req.body || {}) as {
    restaurantOrderId?: string;
    docType?: "FE" | "TE";
    receiver?: unknown;
    situation?: string;
  };
  if (!restaurantOrderId) return res.status(400).json({ message: "restaurantOrderId requerido" });
  if (docType !== "FE" && docType !== "TE") return res.status(400).json({ message: "docType inválido (FE/TE)" });

  const cfg = await prisma.eInvoicingConfig.findUnique({
    where: { hotelId },
    select: { enabled: true, settings: true },
  });
  const settings = (cfg?.settings || {}) as any;
  if (!cfg?.enabled) return res.status(400).json({ message: "Facturación electrónica no está habilitada" });
  if (settings?.moduleConnections?.restaurant === false) {
    return res.status(400).json({ message: "Restaurante no está habilitado para facturación electrónica" });
  }
  if (!String(settings?.issuer?.idNumber || "").trim()) {
    return res.status(400).json({
      message: "Configure el emisor en Facturación Electrónica (número de identificación del emisor) antes de emitir FE/TE.",
    });
  }

  const order = await prisma.restaurantOrder.findFirst({
    where: { id: String(restaurantOrderId), hotelId },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: "Orden no encontrada para este hotel" });
  if (order.status !== "PAID") {
    return res.status(400).json({ message: "La orden debe estar pagada antes de emitir FE/TE" });
  }

  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  const result = await issueRestaurantDoc({
    hotelId,
    order,
    docType,
    receiver,
    situation,
    actorId: user?.sub ?? null,
  });

  if (!result.doc) {
    return res.status(400).json({
      code: result.skipped || "NOT_ISSUED",
      message:
        result.skipped === "NO_ISSUER"
          ? "Falta el número de identificación del emisor en Facturación Electrónica."
          : "La facturación electrónica no está habilitada para este hotel.",
    });
  }

  const { hotelId: _h, ...safe } = result.doc as any;
  return res.json({ ...safe, created: result.created });
}
