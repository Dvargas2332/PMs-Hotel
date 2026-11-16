import { describe, it, expect } from "vitest";
import { calculateOrderTotals, beforeDiscountTotals } from "./restaurantTaxes";

describe("beforeDiscountTotals", () => {
  it("deja los importes como están cuando no hay descuento", () => {
    const shown = beforeDiscountTotals({ subtotal: 1000, service: 100, tax: 130, total: 1230, discountTotal: 0 });
    expect(shown).toEqual({ subtotal: 1000, service: 100, tax: 130, discount: 0, total: 1230 });
  });

  it("muestra el desglose antes del descuento para que la cuenta cuadre", () => {
    const shown = beforeDiscountTotals({ subtotal: 9000, service: 900, tax: 1170, total: 11070, discountTotal: 1230 });
    expect(shown.subtotal).toBe(10000);
    expect(shown.service).toBe(1000);
    expect(shown.tax).toBe(1300);
    expect(shown.discount).toBe(1230);
    expect(shown.total).toBe(11070);
    expect(shown.subtotal + shown.service + shown.tax - shown.discount).toBe(shown.total);
  });

  it("absorbe el redondeo en el IVA y la suma sigue cuadrando", () => {
    const shown = beforeDiscountTotals({ subtotal: 3333.33, service: 333.33, tax: 433.34, total: 4100.01, discountTotal: 12.34 });
    const sum = Number((shown.subtotal + shown.service + shown.tax - shown.discount).toFixed(2));
    expect(sum).toBe(shown.total);
  });

  it("cuadra con los totales que calcula calculateOrderTotals", () => {
    const totals = calculateOrderTotals([{ price: 12300, qty: 1 }], { iva: 13, servicio: 10 }, 10);
    expect(totals.total).toBe(11070);
    expect(totals.discountAmount).toBe(1230);
    const shown = beforeDiscountTotals({ ...totals, discountTotal: totals.discountAmount });
    expect(Number((shown.subtotal + shown.service + shown.tax - shown.discount).toFixed(2))).toBe(totals.total);
  });
});
