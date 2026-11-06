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

/** Tope del XML de un comprobante: uno real con cientos de líneas no pasa de ~100 KB. */
export const MAX_CR_XML_BYTES = 1_000_000;

/**
 * Un comprobante de Hacienda v4.4 nunca trae declaración de tipo de documento
 * ni entidades propias. Rechazarlas antes de parsear corta el DoS por
 * expansión de entidades (billion laughs) sin depender de la versión del parser.
 */
export function assertSafeCrXml(xml: string): void {
  if (typeof xml !== "string" || !xml.trim()) {
    throw new Error("XML vacío");
  }
  if (Buffer.byteLength(xml, "utf8") > MAX_CR_XML_BYTES) {
    throw new Error("El XML supera el límite de 1 MB");
  }
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(xml)) {
    throw new Error("El XML no puede incluir DOCTYPE ni ENTITY");
  }
}

export function parseCrEInvoiceXml(xml: string): ParsedCrEInvoice {
  assertSafeCrXml(xml);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    // Sin conversión numérica: la Clave son 50 dígitos y como número se volvía
    // 5.060611250031012e+49, perdiendo el identificador fiscal del comprobante.
    parseTagValue: false,
    parseAttributeValue: false,
    removeNSPrefix: true,
  });

  const raw = parser.parse(xml);
  // La declaración <?xml ...?> entra como primera clave ("?xml"): si se toma a
  // ciegas, el documento queda sin clave, sin consecutivo y como FE aunque sea TE.
  const root = Object.keys(raw || {}).find((k) => !k.startsWith("?")) || "";
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

