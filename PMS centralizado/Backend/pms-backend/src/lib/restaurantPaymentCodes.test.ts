import { describe, expect, it } from "vitest";
import { isCashPaymentMethod, normalizePaymentKey, resolveHaciendaPaymentCode } from "./restaurantPaymentCodes.js";

describe("resolveHaciendaPaymentCode", () => {
  it("mapea las claves del POS a los códigos de Hacienda", () => {
    expect(resolveHaciendaPaymentCode({ key: "cash" })).toBe("01");
    expect(resolveHaciendaPaymentCode({ key: "card" })).toBe("02");
    expect(resolveHaciendaPaymentCode({ key: "transfer" })).toBe("04");
    expect(resolveHaciendaPaymentCode({ key: "sinpe" })).toBe("06");
    expect(resolveHaciendaPaymentCode({ key: "room" })).toBe("99");
  });

  it("entiende nombres en español con acentos y espacios", () => {
    expect(resolveHaciendaPaymentCode({ key: "efectivo" })).toBe("01");
    expect(resolveHaciendaPaymentCode({ key: "SINPE Móvil" })).toBe("06");
    expect(resolveHaciendaPaymentCode({ key: "Tarjeta de crédito" })).toBe("02");
    expect(resolveHaciendaPaymentCode({ key: "transferencia" })).toBe("04");
  });

  it("respeta el código explícito configurado por el hotel", () => {
    expect(resolveHaciendaPaymentCode({ key: "mi-metodo", explicitCode: "5" })).toBe("05");
    expect(resolveHaciendaPaymentCode({ key: "cash", explicitCode: "07" })).toBe("07");
  });

  it("ignora códigos inválidos y cae al nombre o a 99", () => {
    expect(resolveHaciendaPaymentCode({ key: "cash", explicitCode: "abc" })).toBe("01");
    expect(resolveHaciendaPaymentCode({ key: "bitcoin" })).toBe("99");
    expect(resolveHaciendaPaymentCode({})).toBe("99");
  });

  it("acepta un código numérico guardado como clave", () => {
    expect(resolveHaciendaPaymentCode({ key: "6" })).toBe("06");
  });
});

describe("isCashPaymentMethod", () => {
  it("solo el efectivo entra a la caja física", () => {
    expect(isCashPaymentMethod({ key: "cash" })).toBe(true);
    expect(isCashPaymentMethod({ key: "Efectivo" })).toBe(true);
    expect(isCashPaymentMethod({ key: "card" })).toBe(false);
    expect(isCashPaymentMethod({ key: "sinpe" })).toBe(false);
    expect(isCashPaymentMethod({ key: "transfer" })).toBe(false);
    expect(isCashPaymentMethod({ key: "room" })).toBe(false);
  });
});

describe("normalizePaymentKey", () => {
  it("quita acentos, mayúsculas y separadores", () => {
    expect(normalizePaymentKey("SINPE Móvil")).toBe("sinpemovil");
    expect(normalizePaymentKey("Tarjeta_de-Crédito")).toBe("tarjetadecredito");
  });
});
