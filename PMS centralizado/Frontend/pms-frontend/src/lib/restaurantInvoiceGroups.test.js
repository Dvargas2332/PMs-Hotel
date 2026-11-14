import { describe, it, expect } from "vitest";
import { computeInvoiceGroups, sumInvoiceGroups, INVOICE_REPORT_MODES } from "./restaurantInvoiceGroups";

// El reporte de facturas tenía los modos como radios que no hacían nada: siempre
// se veía el detalle. Estas pruebas fijan qué resume cada modo.
const ROWS = [
  {
    id: "doc1",
    docType: "FE",
    status: "ACCEPTED",
    order: {
      total: 11300,
      waiterId: "w1",
      cashierId: "c1",
      currency: "CRC",
      paymentCurrencies: ["CRC"],
      items: [
        { name: "Casado", category: "Almuerzos", qty: 2, price: 3500 },
        { name: "Café", category: "Bebidas", qty: 1, price: 1000 },
      ],
    },
  },
  {
    id: "doc2",
    docType: "TE",
    status: "ACCEPTED",
    order: {
      total: 5000,
      waiterId: "",
      cashierId: "c1",
      currency: "USD",
      paymentCurrencies: ["USD"],
      items: [{ name: "Cerveza", category: "Bebidas", qty: 2, price: 2500 }],
    },
  },
];

const NAMES = { w1: "María", c1: "Carlos" };
const nameOf = (id) => NAMES[id] || String(id || "-");

describe("agrupaciones del reporte de facturas", () => {
  it("el detalle no agrupa", () => {
    expect(computeInvoiceGroups(ROWS, "Detallado", nameOf)).toEqual([]);
  });

  it("resumido agrupa por tipo de comprobante y suma el total", () => {
    const groups = computeInvoiceGroups(ROWS, "Resumido", nameOf);
    expect(groups).toHaveLength(2);
    const fe = groups.find((g) => g.label === "FE");
    const te = groups.find((g) => g.label === "TE");
    expect(fe).toMatchObject({ count: 1, amount: 11300 });
    expect(te).toMatchObject({ count: 1, amount: 5000 });
    // Ordenado de mayor a menor monto.
    expect(groups[0].label).toBe("FE");
  });

  it("por familias suma las líneas de cada familia", () => {
    const groups = computeInvoiceGroups(ROWS, "Detallado por Familias", nameOf);
    const bebidas = groups.find((g) => g.label === "Bebidas");
    const almuerzos = groups.find((g) => g.label === "Almuerzos");
    expect(almuerzos).toMatchObject({ qty: 2, amount: 7000 });
    // Dos líneas de bebidas (café y cerveza) se juntan en una sola fila.
    expect(bebidas).toMatchObject({ count: 2, qty: 3, amount: 6000 });
  });

  it("por meseros usa el nombre y separa las ventas sin mesero", () => {
    const groups = computeInvoiceGroups(ROWS, "Agrupado por Meseros", nameOf);
    const maria = groups.find((g) => g.label === "María");
    const sinMesero = groups.find((g) => g.label.startsWith("Sin mesero"));
    expect(maria).toMatchObject({ count: 1, amount: 11300 });
    expect(sinMesero?.label).toBe("Sin mesero (cobró Carlos)");
    expect(sinMesero).toMatchObject({ amount: 5000 });
  });

  it("por monedas usa la moneda del cobro, no la del hotel", () => {
    const groups = computeInvoiceGroups(ROWS, "Agrupado por Monedas", nameOf);
    expect(groups.map((g) => g.label).sort()).toEqual(["CRC", "USD"]);
    expect(groups.find((g) => g.label === "USD")).toMatchObject({ count: 1, amount: 5000 });
  });

  it("los totales suman registros y montos", () => {
    const groups = computeInvoiceGroups(ROWS, "Resumido", nameOf);
    expect(sumInvoiceGroups(groups)).toEqual({ count: 2, amount: 16300 });
  });

  it("tolera filas vacías", () => {
    expect(computeInvoiceGroups(null, "Resumido", nameOf)).toEqual([]);
    expect(computeInvoiceGroups([{}], "Resumido", nameOf)[0]).toMatchObject({ label: "-", amount: 0 });
  });

  it("los modos ofrecidos son los cinco de la pantalla", () => {
    expect(INVOICE_REPORT_MODES).toHaveLength(5);
    expect(INVOICE_REPORT_MODES[0]).toBe("Detallado");
  });
});
