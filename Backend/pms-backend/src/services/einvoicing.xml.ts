import { XMLParser } from "fast-xml-parser";

export type ParsedCrEInvoice = {
  docType: "FE" | "TE";
  root: string;
  key?: string;
  consecutive?: string;
  issueDate?: string;
  emitter?: {
    name?: string;
    id?: string;
    idType?: string;
    email?: string;
  };
  receiver?: {
    name?: string;
    id?: string;
    idType?: string;
    email?: string;
  };
  totals?: Record<string, any>;
  lines?: Array<Record<string, any>>;
  raw: any;
};

function pick(obj: any, path: string[]): any {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[key];
  }
  return cur;
}

function toArray(v: any): any[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseCrEInvoiceXml(xml: string): ParsedCrEInvoice {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    parseTagValue: true,
    parseAttributeValue: true,
    removeNSPrefix: true,
  });

  const raw = parser.parse(xml);
  const root = Object.keys(raw || {})[0] || "";
  const rootObj = root ? raw[root] : raw;

  const rootUpper = String(root || "").toLowerCase();
  const docType: "FE" | "TE" =
    rootUpper.includes("tiqueteelectronico") || rootUpper.includes("tiquete")
      ? "TE"
      : "FE";

  const key = String(pick(rootObj, ["Clave"]) || pick(rootObj, ["clave"]) || "").trim() || undefined;
  const consecutive =
    String(pick(rootObj, ["NumeroConsecutivo"]) || pick(rootObj, ["numeroConsecutivo"]) || "").trim() || undefined;
  const issueDate =
    String(pick(rootObj, ["FechaEmision"]) || pick(rootObj, ["fechaEmision"]) || "").trim() || undefined;

  const emitter = pick(rootObj, ["Emisor"]) || {};
  const receiver = pick(rootObj, ["Receptor"]) || {};

  const emitterId = pick(emitter, ["Identificacion"]) || {};
  const receiverId = pick(receiver, ["Identificacion"]) || {};

  const totals =
    pick(rootObj, ["ResumenFactura"]) ||
    pick(rootObj, ["Resumen"]) ||
    pick(rootObj, ["resumenFactura"]) ||
    undefined;

  const linesNode =
    pick(rootObj, ["DetalleServicio", "LineaDetalle"]) ||
    pick(rootObj, ["Detalle", "LineaDetalle"]) ||
    pick(rootObj, ["detalleServicio", "lineaDetalle"]) ||
    undefined;

  return {
    docType,
    root,
    key,
    consecutive,
    issueDate,
    emitter: {
      name: emitter?.Nombre,
      email: emitter?.CorreoElectronico,
      idType: emitterId?.Tipo,
      id: emitterId?.Numero,
    },
    receiver: {
      name: receiver?.Nombre,
      email: receiver?.CorreoElectronico,
      idType: receiverId?.Tipo,
      id: receiverId?.Numero,
    },
    totals: totals && typeof totals === "object" ? totals : undefined,
    lines: toArray(linesNode),
    raw,
  };
}

