import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import signer from "haciendacostarica-signer";

/**
 * Firma del comprobante electrónico 4.4 de Costa Rica.
 *
 * Usa `haciendacostarica-signer` (MIT), que produce XAdES-EPES con la política
 * de Hacienda. La librería asume un navegador: acá se registran las piezas DOM
 * de Node en la MISMA copia de `xml-core` que ella usa, no en otra.
 */
// El firmador arrastra varias copias de xml-core (xadesjs → xmldsigjs → …), y
// cada copia guarda su propio registro de dependencias: hay que darle el parser
// de Node a todas o la firma falla en la copia que no se registró.
const requireNested = createRequire(import.meta.url);
const NODE_MODULES = join(process.cwd(), "node_modules");

function findXmlCoreCopies(dir: string, depth: number, found: Set<string>) {
  if (depth > 4) return;
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "xml-core") {
      found.add(join(dir, "xml-core"));
      continue;
    }
    const pkgDir = join(dir, entry.name);
    if (entry.name.startsWith("@")) {
      findXmlCoreCopies(pkgDir, depth, found);
      continue;
    }
    const nested = join(pkgDir, "node_modules");
    if (existsSync(join(nested, "xml-core"))) found.add(join(nested, "xml-core"));
    if (existsSync(nested)) findXmlCoreCopies(nested, depth + 1, found);
  }
}

function registerDomDependencies(xmlCorePath: string) {
  try {
    const mod = requireNested(xmlCorePath) as { setNodeDependencies?: (deps: Record<string, unknown>) => void };
    mod?.setNodeDependencies?.({ DOMParser, XMLSerializer });
  } catch {
    // Copia ausente o incompatible: se ignora.
  }
}

const xmlCoreCopies = new Set<string>();
findXmlCoreCopies(NODE_MODULES, 0, xmlCoreCopies);
for (const copy of xmlCoreCopies) registerDomDependencies(copy);

export interface SignedXml {
  /** XML firmado (texto). */
  xmlSigned: string;
  /** El mismo XML en base64, como lo pide el ATV al enviar. */
  xmlSignedBase64: string;
}

export function certificateFromBase64(certBase64: string): string {
  return String(certBase64 || "").replace(/^data:[^,]+,/, "").trim();
}

/** Verifica que la llave y su contraseña sirvan, y dice cuándo expira. */
export async function checkCertificate(
  certBase64: string,
  password: string
): Promise<{ valid: boolean; expiresOn?: string }> {
  const verify = await (signer as any).verifySignature(certificateFromBase64(certBase64), String(password || ""));
  return { valid: Boolean(verify?.isValid), expiresOn: verify?.expiresOn ? String(verify.expiresOn) : undefined };
}

/** Firma el XML sin firmar y devuelve el comprobante firmado. */
export async function signCrXml(xml: string, certBase64: string, password: string): Promise<SignedXml> {
  const unsigned = String(xml || "").trim();
  if (!unsigned) throw new Error("No hay XML para firmar");
  const cert = certificateFromBase64(certBase64);
  if (!cert) throw new Error("Falta el certificado .p12 del emisor");
  if (!String(password || "")) throw new Error("Falta la contraseña del certificado");

  const signedBase64 = await (signer as any).sign(unsigned, cert, String(password));
  const xmlSigned =
    typeof signedBase64 === "string" && signedBase64.trim().startsWith("<")
      ? signedBase64
      : Buffer.from(String(signedBase64), "base64").toString("utf8");

  if (!/<(ds:)?Signature/.test(xmlSigned)) {
    throw new Error("La firma no se generó: el XML firmado no trae Signature");
  }
  return { xmlSigned, xmlSignedBase64: Buffer.from(xmlSigned, "utf8").toString("base64") };
}
