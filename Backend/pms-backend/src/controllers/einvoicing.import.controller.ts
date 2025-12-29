import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { parseCrEInvoiceXml } from "../services/einvoicing.xml.js";
import { onEInvoicingXmlImported } from "../services/inventory.integration.js";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

export async function importEInvoicingXml(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const xml = String((req.body as any)?.xml || "").trim();
  if (!xml) return res.status(400).json({ message: "xml requerido" });

  let parsed: ReturnType<typeof parseCrEInvoiceXml>;
  try {
    parsed = parseCrEInvoiceXml(xml);
  } catch (err: any) {
    return res.status(400).json({ message: err?.message || "XML inválido" });
  }

  if (!parsed.root) return res.status(400).json({ message: "XML inválido: no root" });
  if (parsed.docType !== "FE" && parsed.docType !== "TE") {
    return res.status(400).json({ message: "Tipo de documento no soportado (solo FE/TE)" });
  }

  if (parsed.key) {
    const existing = await prisma.eInvoicingDocument.findFirst({
      where: { hotelId, key: parsed.key, docType: parsed.docType },
    });
    if (existing) return res.json({ id: existing.id, reused: true });
  }

  const receiver = parsed.receiver && (parsed.receiver.id || parsed.receiver.name) ? parsed.receiver : null;

  const doc = await prisma.eInvoicingDocument.create({
    data: {
      hotelId,
      docType: parsed.docType,
      status: "SIGNED",
      key: parsed.key || null,
      consecutive: parsed.consecutive || null,
      receiver: receiver as any,
      payload: {
        source: "import",
        importedAt: new Date().toISOString(),
        issueDate: parsed.issueDate || null,
        root: parsed.root,
        emitter: parsed.emitter || null,
        receiver: parsed.receiver || null,
        totals: parsed.totals || null,
        lines: parsed.lines || [],
      } as any,
      xmlSigned: xml,
      response: { imported: true } as any,
    },
  });

  await onEInvoicingXmlImported({
    hotelId,
    docType: parsed.docType,
    key: parsed.key,
    consecutive: parsed.consecutive,
    totals: parsed.totals,
    lines: parsed.lines,
  });

  return res.json({ id: doc.id, reused: false });
}

