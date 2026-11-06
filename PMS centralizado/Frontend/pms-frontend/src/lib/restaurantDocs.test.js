import { describe, it, expect } from "vitest";
import { buildCloseReportText, buildPrintPreviewText, buildRestaurantHeaderLines } from "./restaurantDocs";

const restaurant = {
  nombreComercial: "Cafetería Kaze",
  razonSocial: "Kazehana Restaurante S.A.",
  cedula: "3-101-123456",
  telefono: "2222-3333",
  direccion: "San José, Central",
};

describe("buildCloseReportText", () => {
  it("incluye totales, transacciones y diferencia", () => {
    const text = buildCloseReportText({
      stage: "Z",
      shiftNumber: 3,
      openedAt: "2026-11-04T08:00:00Z",
      closedAt: "2026-11-04T18:00:00Z",
      systemTotal: 1000,
      byMethod: { Efectivo: 1000 },
      declared: { Efectivo: 950 },
      diff: -50,
      salesCount: 4,
      note: "cierre normal",
    });
    expect(text).toContain("CIERRE Z DE CAJA");
    expect(text).toContain("TOTAL SISTEMA:");
    expect(text).toContain("1000.00");
    expect(text).toContain("DIFERENCIA:");
    expect(text).toContain("-50.00");
    expect(text).toContain("Transacciones: 4");
    expect(text).toContain("cierre normal");
  });

  it("marca la reimpresión del cierre", () => {
    const text = buildCloseReportText({ stage: "Z", reprint: true, systemTotal: 0, byMethod: {}, salesCount: 0 });
    expect(text).toContain("REIMPRESION CIERRE Z DE CAJA");
  });

  it("usa los datos del restaurante en lugar del nombre del hotel", () => {
    const text = buildCloseReportText({
      stage: "Z",
      hotelName: "Hotel Demo",
      restaurant,
      systemTotal: 0,
      byMethod: {},
      salesCount: 0,
    });
    expect(text).toContain("Cafetería Kaze");
    expect(text).toContain("Cedula: 3-101-123456");
    expect(text).not.toContain("Hotel Demo");
  });
});

describe("buildRestaurantHeaderLines", () => {
  it("arma nombre, razón social, cédula, teléfono y dirección", () => {
    const lines = buildRestaurantHeaderLines(restaurant);
    expect(lines.join("\n")).toContain("Cafetería Kaze");
    expect(lines.join("\n")).toContain("Kazehana Restaurante S.A.");
    expect(lines.join("\n")).toContain("Cedula: 3-101-123456");
    expect(lines.join("\n")).toContain("Tel: 2222-3333");
    expect(lines.join("\n")).toContain("San José, Central");
  });

  it("no inventa líneas cuando no hay datos", () => {
    expect(buildRestaurantHeaderLines(null)).toEqual([]);
    expect(buildRestaurantHeaderLines({})).toEqual([]);
  });
});

describe("buildPrintPreviewText", () => {
  it("imprime encabezado, documento, items, totales y anulación", () => {
    const text = buildPrintPreviewText({
      title: "FACTURA ELECTRONICA",
      payload: {
        __printHeader: "HOTEL DEMO",
        documentNumber: "001",
        tableId: "5",
        items: [{ name: "Cafe", qty: 2, price: 1000 }],
        note: "sin azucar",
        paymentMethods: [{ name: "Efectivo", amount: 2000 }],
        canceled: true,
        cancelReason: "error de cobro",
      },
      totals: { subtotal: 1770, tax: 230, total: 2000 },
      money: (v) => `₡${Number(v).toFixed(2)}`,
    });
    expect(text).toContain("HOTEL DEMO");
    expect(text).toContain("N° Documento: 001");
    expect(text).toContain("2 x Cafe");
    expect(text).toContain("₡2000.00");
    expect(text).toContain("TOTAL:");
    expect(text).toContain("*** DOCUMENTO ANULADO ***");
    expect(text).toContain("Motivo: error de cobro");
  });

  it("usa los datos del restaurante cuando no hay encabezado configurado", () => {
    const text = buildPrintPreviewText({
      title: "Comanda",
      payload: { tableId: "M1", items: [{ name: "Cafe", qty: 1, price: 1000 }] },
      totals: { total: 1000 },
      restaurant,
    });
    expect(text).toContain("Cafetería Kaze");
    expect(text).toContain("Cedula: 3-101-123456");
  });

  it("respeta el encabezado configurado por encima de los datos del restaurante", () => {
    const text = buildPrintPreviewText({
      title: "Ticket",
      payload: { __printHeader: "ENCABEZADO PROPIO", items: [] },
      totals: { total: 0 },
      restaurant,
    });
    expect(text).toContain("ENCABEZADO PROPIO");
    expect(text).not.toContain("Cafetería Kaze");
  });
});
