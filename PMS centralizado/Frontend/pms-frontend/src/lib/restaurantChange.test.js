import { describe, it, expect } from "vitest";
import { computePaymentSplit } from "./restaurantChange";

// Cobro del POS: lo que el cliente entrega, el vuelto que sale del efectivo y lo
// que efectivamente se aplica a la venta (el servidor exige que sume el total).
describe("reparto del cobro y vuelto", () => {
  it("cobra exacto sin vuelto", () => {
    const r = computePaymentSplit({ amounts: { efectivo: 1800 }, total: 1800, cashKey: "efectivo" });
    expect(r.received).toBe(1800);
    expect(r.change).toBe(0);
    expect(r.applied.efectivo).toBe(1800);
    expect(r.square).toBe(true);
  });

  it("entrega 2000 por una venta de 1800: vuelto 200 y se aplican 1800", () => {
    const r = computePaymentSplit({ amounts: { efectivo: 2000 }, total: 1800, cashKey: "efectivo" });
    expect(r.change).toBe(200);
    expect(r.applied.efectivo).toBe(1800);
    expect(r.appliedTotal).toBe(1800);
    expect(r.square).toBe(true);
  });

  it("mixto: efectivo 2000 + tarjeta 1000 por 2800 deja vuelto de 200 en el efectivo", () => {
    const r = computePaymentSplit({ amounts: { efectivo: 2000, tarjeta: 1000 }, total: 2800, cashKey: "efectivo" });
    expect(r.change).toBe(200);
    expect(r.applied.efectivo).toBe(1800);
    expect(r.applied.tarjeta).toBe(1000);
    expect(r.appliedTotal).toBe(2800);
    expect(r.square).toBe(true);
  });

  it("sin efectivo no se puede dar vuelto: sobran 200 y no cuadra", () => {
    const r = computePaymentSplit({ amounts: { tarjeta: 2000 }, total: 1800, cashKey: "efectivo" });
    expect(r.change).toBe(200);
    expect(r.applied.tarjeta).toBe(2000);
    expect(r.appliedTotal).toBe(2000);
    expect(r.square).toBe(false);
  });

  it("si el efectivo no alcanza para el vuelto, el efectivo queda en cero", () => {
    const r = computePaymentSplit({ amounts: { efectivo: 100, tarjeta: 1800 }, total: 1800, cashKey: "efectivo" });
    expect(r.change).toBe(100);
    expect(r.applied.efectivo).toBe(0);
    expect(r.appliedTotal).toBe(1800);
    expect(r.square).toBe(true);
  });

  it("falta por cobrar cuando entrega menos que el total", () => {
    const r = computePaymentSplit({ amounts: { efectivo: 1000 }, total: 1800, cashKey: "efectivo" });
    expect(r.change).toBe(0);
    expect(r.missing).toBe(800);
    expect(r.square).toBe(false);
  });

  it("no queda descuadre por centavos del tipo de cambio", () => {
    const r = computePaymentSplit({ amounts: { efectivo: 1833.33 }, total: 1800.4, cashKey: "efectivo" });
    expect(r.change).toBe(32.93);
    expect(r.applied.efectivo).toBe(1800.4);
    expect(r.square).toBe(true);
  });
});
