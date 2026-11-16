import { describe, expect, it } from "vitest";
import { buildCrXml, buildSummaryFromLines, type CrLineItem } from "./einvoicing.xml.builder.js";

const money = (n: number) => n.toFixed(2);

function tag(xml: string, name: string) {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? Number(m[1]) : NaN;
}

const issuer = {
  name: "Kazehana Restaurante S.A.",
  idType: "02",
  idNumber: "3101123456",
  economicActivity: "563001",
};

function buildWith(lines: CrLineItem[]) {
  const summary = buildSummaryFromLines(lines);
  const xml = buildCrXml({
    docType: "TE",
    key: "50617112500310112345600100001010000000001199999999",
    consecutive: "00100001010000000001",
    issueDate: new Date("2026-11-17T12:00:00Z"),
    issuer,
    currency: "CRC",
    items: lines,
    payments: [{ method: "01", amount: summary.totalAmount }],
    summary,
  });
  return { xml, summary };
}

describe("comprobante del restaurante con descuento", () => {
  // Casado de 12.300 con 13% de IVA y 10% de servicio, 10% de descuento en la orden.
  const line: CrLineItem = {
    lineNumber: 1,
    qty: 1,
    unitCode: "Sp",
    description: "Casado",
    unitPrice: 10000,
    discount: 1000,
    discountReason: "Descuento",
    subtotal: 9000,
    taxCode: "01",
    taxRate: 13,
    taxBase: 9000,
    taxAmount: 1170,
    total: 10170,
  };
  const serviceLine: CrLineItem = {
    lineNumber: 2,
    qty: 1,
    unitCode: "Sp",
    description: "10% Servicio",
    unitPrice: 900,
    discount: 0,
    subtotal: 900,
    total: 900,
  };

  it("declara el descuento en la línea y no rebaja el precio unitario", () => {
    const { xml } = buildWith([line, serviceLine]);
    expect(xml).toContain("<MontoDescuento>1000.00</MontoDescuento>");
    expect(xml).toContain("<NaturalezaDescuento>Descuento</NaturalezaDescuento>");
    expect(xml).toContain("<PrecioUnitario>10000.00000</PrecioUnitario>");
    expect(xml).toContain("<MontoTotal>10000.00</MontoTotal>");
    expect(xml).toContain("<SubTotal>9000.00</SubTotal>");
  });

  it("cuadra el resumen como lo pide Hacienda", () => {
    const { xml } = buildWith([line, serviceLine]);
    const venta = tag(xml, "TotalVenta");
    const descuentos = tag(xml, "TotalDescuentos");
    const neta = tag(xml, "TotalVentaNeta");
    const impuesto = tag(xml, "TotalImpuesto");
    const comprobante = tag(xml, "TotalComprobante");

    expect(descuentos).toBe(1000);
    expect(neta).toBe(9900);
    expect(impuesto).toBe(1170);
    // TotalVenta − TotalDescuentos = TotalVentaNeta
    expect(Number(money(venta - descuentos))).toBe(neta);
    // TotalVentaNeta + TotalImpuesto = TotalComprobante (la venta cobrada)
    expect(Number(money(neta + impuesto))).toBe(comprobante);
    expect(comprobante).toBe(11070);
  });

  it("sin descuento la venta es la suma de las líneas", () => {
    const sinDescuento: CrLineItem = { ...line, unitPrice: 9000, discount: 0, discountReason: undefined };
    const { xml } = buildWith([sinDescuento, serviceLine]);
    expect(tag(xml, "TotalDescuentos")).toBe(0);
    expect(tag(xml, "TotalVenta")).toBe(9900);
    expect(tag(xml, "TotalVentaNeta")).toBe(9900);
    expect(tag(xml, "TotalComprobante")).toBe(11070);
  });
});
