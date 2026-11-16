import { describe, it, expect } from "vitest";
import forge from "node-forge";
import { buildCrXml } from "./einvoicing.xml.builder.js";
import { signCrXml } from "./einvoice.sign.js";

/**
 * Firma del comprobante 4.4 con la librería `haciendacostarica-signer`.
 * Se genera un .p12 autofirmado para no depender de un certificado real.
 */
function makeP12(passphrase = "prueba123") {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const attrs = [{ name: "commonName", value: "PRUEBA PMS" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: "3des" });
  return forge.util.encode64(forge.asn1.toDer(p12Asn1).getBytes());
}

const issuer = {
  name: "KAZEHANA CLOUD SA",
  idType: "02",
  idNumber: "3101234567",
  economicActivity: "551001",
};
const items = [
  {
    lineNumber: 1,
    cabysCode: "5510010000000",
    qty: 1,
    unitCode: "Sp",
    description: "Hospedaje",
    unitPrice: 10000,
    subtotal: 10000,
    taxCode: "01",
    taxRate: 13,
    taxBase: 10000,
    taxAmount: 1300,
    total: 11300,
  },
];
const summary = {
  totalGravado: 10000,
  totalExento: 0,
  totalExonerado: 0,
  totalVenta: 10000,
  totalDescuento: 0,
  totalImpuesto: 1300,
  totalComprobante: 11300,
};

function build(docType: "TE" | "FE") {
  return buildCrXml({
    docType,
    key: "5061308202601010001010010000101000000000113",
    consecutive: "00100001010000000001",
    issueDate: new Date("2026-11-13T10:00:00-06:00"),
    issuer,
    receiver:
      docType === "FE"
        ? { name: "CLIENTE PRUEBA", idType: "01", idNumber: "102340567", email: "cliente@prueba.test" }
        : undefined,
    currency: "CRC",
    items,
    payments: [{ method: "01", amount: 11300 }],
    summary,
    condition: "01",
  } as any);
}

describe("firma XAdES-EPES del comprobante 4.4", () => {
  const p12 = makeP12();

  it("firma el tiquete con el sello de Hacienda", async () => {
    const { xmlSigned, xmlSignedBase64 } = await signCrXml(build("TE"), p12, "prueba123");
    expect(Buffer.from(xmlSignedBase64, "base64").toString("utf8")).toBe(xmlSigned);
    expect(xmlSigned).toMatch(/<TiqueteElectronico/);
    expect(xmlSigned).toMatch(/<ds:Signature|Signature /);
    expect(xmlSigned).toContain("SignedProperties");
    expect(xmlSigned).toContain("SignaturePolicyIdentifier");
    expect(xmlSigned).toContain("tribunet.hacienda.go.cr");
    expect(xmlSigned).toContain("ObligadoTributario");
    expect(xmlSigned).not.toContain("<Receptor>");
  });

  it("firma la factura con receptor y con SHA-256", async () => {
    const { xmlSigned } = await signCrXml(build("FE"), p12, "prueba123");
    expect(xmlSigned).toMatch(/<FacturaElectronica/);
    expect(xmlSigned).toContain("<Receptor>");
    expect(xmlSigned).toContain("http://www.w3.org/2001/04/xmlenc#sha256");
    expect(xmlSigned).toContain("rsa-sha256");
  });

  it("no firma con contraseña incorrecta", async () => {
    await expect(signCrXml(build("TE"), p12, "otra")).rejects.toBeTruthy();
  });

  it("exige certificado y contraseña", async () => {
    await expect(signCrXml(build("TE"), "", "prueba123")).rejects.toThrow(/certificado/i);
    await expect(signCrXml(build("TE"), p12, "")).rejects.toThrow(/contraseña/i);
  });
});
