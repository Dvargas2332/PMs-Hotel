import { describe, it, expect } from "vitest";
import { isRealIdentification, resolveIssuerIdNumber } from "./einvoice.issuer.js";

// El cierre de una venta no puede quedarse sin comprobante por un dato que no
// aplica (el cliente) ni por un marcador de posición en la cédula del hotel.
describe("identificación del emisor", () => {
  it("acepta cédulas físicas, jurídicas y DIMEX", () => {
    expect(isRealIdentification("102340567")).toBe(true);
    expect(isRealIdentification("3101234567")).toBe(true);
    expect(isRealIdentification("155812345678")).toBe(true);
    expect(isRealIdentification("3-101-234567")).toBe(true);
  });

  it("rechaza marcadores de posición y valores incompletos", () => {
    expect(isRealIdentification("000000000")).toBe(false);
    expect(isRealIdentification("111111111")).toBe(false);
    expect(isRealIdentification("")).toBe(false);
    expect(isRealIdentification(null)).toBe(false);
    expect(isRealIdentification("1234")).toBe(false);
    expect(isRealIdentification("no-aplica")).toBe(false);
  });

  it("usa la cédula de facturación electrónica cuando existe", () => {
    expect(resolveIssuerIdNumber("3101234567", "000000000")).toBe("3101234567");
  });

  it("cae a la identificación de la empresa del hotel si la de FE está vacía o es de ceros", () => {
    expect(resolveIssuerIdNumber("", "3101234567")).toBe("3101234567");
    expect(resolveIssuerIdNumber("000000000", "3101234567")).toBe("3101234567");
  });

  it("no inventa una cédula: devuelve vacío si ninguna sirve", () => {
    expect(resolveIssuerIdNumber("", "000000000")).toBe("");
    expect(resolveIssuerIdNumber(undefined, undefined)).toBe("");
  });
});
