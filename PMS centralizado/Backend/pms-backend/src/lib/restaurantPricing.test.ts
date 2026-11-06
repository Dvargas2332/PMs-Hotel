import { describe, it, expect } from "vitest";
import { parseVariantKey, resolveAllowedUnitPrices, isPriceAllowed } from "./restaurantPricing.js";

describe("parseVariantKey", () => {
  it("separa tamaño, detalles e ignora la nota", () => {
    const result = parseVariantKey("size:g|detail:queso|detail:extra|note:Hola%20mundo");
    expect(result.sizeKey).toBe("g");
    expect(result.detailKeys).toEqual(["queso", "extra"]);
  });

  it("devuelve vacío sin variante", () => {
    expect(parseVariantKey("")).toEqual({ sizeKey: "", detailKeys: [] });
    expect(parseVariantKey(undefined)).toEqual({ sizeKey: "", detailKeys: [] });
  });
});

describe("resolveAllowedUnitPrices", () => {
  it("usa el precio base cuando no hay tallas ni detalles", () => {
    const result = resolveAllowedUnitPrices({ basePrice: 2500, variantKey: "" });
    expect(result.verified).toBe(true);
    expect(result.prices).toEqual([2500]);
    expect(isPriceAllowed(2500, result)).toBe(true);
    expect(isPriceAllowed(1, result)).toBe(false);
  });

  it("toma el precio de la talla elegida", () => {
    const sizes = [
      { id: "s", price: 2000 },
      { id: "g", price: 3000 },
    ];
    const result = resolveAllowedUnitPrices({ basePrice: 2500, sizes, variantKey: "size:g" });
    expect(result.prices).toEqual([3000]);
    expect(isPriceAllowed(3000, result)).toBe(true);
    expect(isPriceAllowed(2500, result)).toBe(false);
  });

  it("suma los extras de los detalles seleccionados", () => {
    const sizes = [{ id: "unico", price: 2500 }];
    const details = [
      { id: "queso", priceDelta: 300 },
      { id: "tocino", price: 200 },
    ];
    const result = resolveAllowedUnitPrices({
      basePrice: 2500,
      sizes,
      details,
      variantKey: "size:unico|detail:queso|detail:tocino",
    });
    expect(result.prices).toEqual([3000]);
  });

  it("acepta el override de menú cuando el artículo no tiene tallas", () => {
    const result = resolveAllowedUnitPrices({
      basePrice: 2500,
      menuOverrides: [2200, 2500],
      variantKey: "",
    });
    expect(result.prices.sort()).toEqual([2200, 2500]);
    expect(isPriceAllowed(2200, result)).toBe(true);
  });

  it("marca no verificable si el tamaño no existe", () => {
    const result = resolveAllowedUnitPrices({
      basePrice: 2500,
      sizes: [{ id: "s", price: 2000 }],
      variantKey: "size:xl",
    });
    expect(result.verified).toBe(false);
    expect(isPriceAllowed(1, result)).toBe(true);
  });

  it("marca no verificable si un detalle no existe", () => {
    const result = resolveAllowedUnitPrices({
      basePrice: 2500,
      details: [{ id: "queso", priceDelta: 300 }],
      variantKey: "detail:inventado",
    });
    expect(result.verified).toBe(false);
  });
});
