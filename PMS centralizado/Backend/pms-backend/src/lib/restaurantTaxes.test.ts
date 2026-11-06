import { describe, it, expect } from "vitest";
import { calculateOrderTotals } from "./restaurantTaxes.js";

describe("calculateOrderTotals", () => {
  it("calcula totales con impuestos globales e impuestos incluidos", () => {
    const items = [
      { price: 1230, qty: 1, priceIncludesTaxesAndService: true, taxes: null },
    ];
    const result = calculateOrderTotals(items, { iva: 13, servicio: 10 });
    expect(result.subtotal).toBeCloseTo(1000, 2);
    expect(result.service).toBeCloseTo(100, 2);
    expect(result.tax).toBeCloseTo(130, 2);
    expect(result.total).toBeCloseTo(1230, 2);
  });

  it("calcula totales con impuestos globales sin incluir", () => {
    const items = [
      { price: 1000, qty: 1, priceIncludesTaxesAndService: false, taxes: null },
    ];
    const result = calculateOrderTotals(items, { iva: 13, servicio: 10 });
    expect(result.subtotal).toBeCloseTo(1000, 2);
    expect(result.service).toBeCloseTo(100, 2);
    expect(result.tax).toBeCloseTo(130, 2);
    expect(result.total).toBeCloseTo(1230, 2);
  });

  it("respeta impuestos por ítem sin fallback (ítem define todos sus impuestos)", () => {
    const items = [
      { price: 1000, qty: 1, priceIncludesTaxesAndService: false, taxes: [{ percent: 5, kind: "IVA" }] },
    ];
    const result = calculateOrderTotals(items, { iva: 13, servicio: 10 });
    expect(result.tax).toBeCloseTo(50, 2);
    expect(result.service).toBeCloseTo(0, 2); // ítem no tiene servicio
    expect(result.total).toBeCloseTo(1050, 2);
  });

  it("usa impuestos globales cuando el ítem no tiene taxes", () => {
    const items = [
      { price: 1000, qty: 1, priceIncludesTaxesAndService: false, taxes: null },
    ];
    const result = calculateOrderTotals(items, { iva: 13, servicio: 10 });
    expect(result.tax).toBeCloseTo(130, 2);
    expect(result.service).toBeCloseTo(100, 2);
    expect(result.total).toBeCloseTo(1230, 2);
  });

  it("aplica descuento de orden correctamente", () => {
    const items = [
      { price: 1000, qty: 1, priceIncludesTaxesAndService: false, taxes: null },
    ];
    const result = calculateOrderTotals(items, { iva: 13, servicio: 10 }, 10);
    expect(result.total).toBeCloseTo(1107, 2); // 1230 * 0.9
    expect(result.discountOrder).toBeCloseTo(123, 2);
  });
});
