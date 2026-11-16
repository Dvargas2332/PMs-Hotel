import { describe, expect, it } from "vitest";
import { buildRestaurantInvoiceLines } from "./restaurant.einvoice.js";
import { buildCrXml, buildSummaryFromLines } from "./einvoicing.xml.builder.js";

const globals = { iva: 13, servicio: 10 };

function catalogWith(...items: Array<{ id: string; cabys?: string; taxes?: Array<{ percent: number; kind: string }> }>) {
  return new Map(
    items.map((it) => [
      it.id,
      {
        id: it.id,
        cabys: it.cabys,
        priceIncludesTaxesAndService: true,
        taxes: (it.taxes ?? [{ percent: 13, kind: "IVA" }, { percent: 10, kind: "SERVICE" }]).map((t) => ({
          tax: { percent: t.percent, kind: t.kind, active: true },
        })),
      },
    ])
  );
}

describe("líneas fiscales del restaurante", () => {
  it("declara el descuento de la orden en la línea y cuadra con la venta", () => {
    // Casado de 12.300 (IVA 13% y 10% incluidos) con 10% de descuento:
    // subtotal 9.000, IVA 1.170, servicio 900, total 11.070.
    const lines = buildRestaurantInvoiceLines({
      items: [{ itemId: "i1", name: "Casado", price: 12300, qty: 1, discountPercent: 0 }],
      catalogById: catalogWith({ id: "i1", cabys: "5011010000100" }),
      globals,
      targetSubtotal: 9000,
      targetTotal: 11070,
    });

    const casado = lines[0];
    expect(casado.unitPrice).toBe(10000);
    expect(casado.discount).toBe(1000);
    expect(casado.subtotal).toBe(9000);
    expect(casado.taxAmount).toBe(1170);
    expect(casado.discountReason).toBe("Descuento");

    const servicio = lines.find((l) => l.description === "10% Servicio");
    expect(servicio?.total).toBe(900);

    const totalLineas = lines.reduce((a, l) => a + l.total, 0);
    expect(Number(totalLineas.toFixed(2))).toBe(11070);
  });

  it("aplica también el descuento del artículo", () => {
    const lines = buildRestaurantInvoiceLines({
      items: [{ itemId: "i1", name: "Casado", price: 12300, qty: 1, discountPercent: 10 }],
      catalogById: catalogWith({ id: "i1" }),
      globals,
      targetSubtotal: 9000,
      targetTotal: 11070,
    });

    expect(lines[0].unitPrice).toBe(10000);
    expect(lines[0].discount).toBe(1000);
    expect(lines[0].subtotal).toBe(9000);
  });

  it("sin descuento no inventa una línea de descuento", () => {
    const lines = buildRestaurantInvoiceLines({
      items: [{ itemId: "i2", name: "Café", price: 2500, qty: 2, discountPercent: 0 }],
      catalogById: catalogWith({ id: "i2", taxes: [{ percent: 13, kind: "IVA" }] }),
      globals,
      targetSubtotal: 4424.78,
      targetTotal: 5000,
    });

    expect(lines[0].discount).toBe(0);
    expect(lines[0].discountReason).toBeUndefined();
    expect(lines[0].unitPrice).toBeCloseTo(2212.39, 2);
    expect(Number(lines.reduce((a, l) => a + l.total, 0).toFixed(2))).toBe(5000);
  });

  it("el XML con ese descuento cumple las identidades del resumen", () => {
    const lines = buildRestaurantInvoiceLines({
      items: [{ itemId: "i1", name: "Casado", price: 12300, qty: 1 }],
      catalogById: catalogWith({ id: "i1", cabys: "5011010000100" }),
      globals,
      targetSubtotal: 9000,
      targetTotal: 11070,
    });
    const summary = buildSummaryFromLines(lines);
    const xml = buildCrXml({
      docType: "TE",
      key: "50617112500310112345600100001010000000001199999999",
      consecutive: "00100001010000000001",
      issueDate: new Date("2026-11-17T12:00:00Z"),
      issuer: { name: "Kazehana Restaurante S.A.", idType: "02", idNumber: "3101123456", economicActivity: "563001" },
      currency: "CRC",
      items: lines,
      payments: [{ method: "01", amount: summary.totalAmount }],
      summary,
    });

    const num = (name: string) => {
      const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
      return m ? Number(m[1]) : NaN;
    };

    expect(xml).toContain("<MontoDescuento>1000.00</MontoDescuento>");
    expect(num("TotalDescuentos")).toBe(1000);
    expect(num("TotalVenta") - num("TotalDescuentos")).toBe(num("TotalVentaNeta"));
    expect(Number((num("TotalVentaNeta") + num("TotalImpuesto")).toFixed(2))).toBe(num("TotalComprobante"));
    expect(num("TotalComprobante")).toBe(11070);
  });
});
