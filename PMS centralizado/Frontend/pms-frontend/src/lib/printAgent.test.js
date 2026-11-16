import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEscPosBytes,
  buildReceiptHtml,
  encodeCp850,
  getPrintAgentConfig,
  listPrintersFromAgent,
  printTextToAgent,
  setPrintAgentConfig,
} from "./printAgent";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", memoryStorage());
});

describe("codificación para impresora térmica", () => {
  it("manda las tildes y la eñe en la página 850", () => {
    const bytes = Array.from(encodeCp850("Café ñ"));
    expect(bytes).toEqual([0x43, 0x61, 0x66, 0x82, 0x20, 0xa4]);
  });

  it("respeta los saltos de línea y el texto de ancho fijo", () => {
    const bytes = Array.from(encodeCp850("=== \n--"));
    expect(bytes).toEqual([0x3d, 0x3d, 0x3d, 0x20, 0x0a, 0x2d, 0x2d]);
  });

  it("un carácter que la impresora no tiene no rompe el trabajo", () => {
    const bytes = Array.from(encodeCp850("₡100"));
    expect(bytes[0]).toBe(0x43); // la colonia se manda como "C"
    expect(bytes).not.toContain(0x3f);
  });

  it("arma el trabajo ESC/POS con inicialización, página 850 y avance", () => {
    const bytes = Array.from(buildEscPosBytes("Hola", { feed: 3 }));
    expect(bytes.slice(0, 5)).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x02]);
    expect(bytes.slice(5, 9)).toEqual([0x48, 0x6f, 0x6c, 0x61]);
    expect(bytes.slice(-4)).toEqual([0x0a, 0x1b, 0x64, 0x03]);
  });

  it("el modo documento arma un papel de 80 mm con el texto tal cual", () => {
    const html = buildReceiptHtml("Total: <1000>");
    expect(html).toContain("size: 80mm auto");
    expect(html).toContain("Total: &lt;1000&gt;");
    expect(html).toContain("<pre>");
  });
});

describe("cliente del agente", () => {
  it("guarda y devuelve la configuración de esta caja", () => {
    setPrintAgentConfig({ url: "http://127.0.0.1:8787/", key: "abc", mode: "html" });
    expect(getPrintAgentConfig()).toEqual({ url: "http://127.0.0.1:8787", key: "abc", mode: "html" });
  });

  it("pide las impresoras con la clave del agente", async () => {
    setPrintAgentConfig({ url: "http://127.0.0.1:8787", key: "abc" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ printers: [{ name: "EPSON TM-T20", alias: "CAJA", mode: "escpos" }], mappings: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const printers = await listPrintersFromAgent({});
    expect(printers).toEqual([{ name: "EPSON TM-T20", alias: "CAJA", mode: "escpos" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8787/api/printers");
    expect(init.headers["X-API-Key"]).toBe("abc");
  });

  it("envía el trabajo a /api/job con el formato del agente", async () => {
    setPrintAgentConfig({ url: "http://127.0.0.1:8787", key: "abc", mode: "escpos" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ job_id: "x", status: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);

    await printTextToAgent({ printerName: "EPSON TM-T20", text: "TOTAL 1000", copies: 2 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8787/api/job");
    expect(init.headers["X-API-Key"]).toBe("abc");
    const body = JSON.parse(init.body);
    expect(body.job.type).toBe("escpos");
    expect(body.job.printer_name).toBe("EPSON TM-T20");
    expect(body.job.copies).toBe(2);
    expect(typeof body.job.payload.raw_base64).toBe("string");
  });

  it("en modo documento manda el HTML en lugar de los bytes", async () => {
    setPrintAgentConfig({ url: "http://127.0.0.1:8787", key: "abc", mode: "html" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);

    await printTextToAgent({ printerName: "EPSON WF-C5810", text: "TOTAL 1000" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.job.type).toBe("html");
    expect(body.job.payload.html).toContain("TOTAL 1000");
  });

  it("si el agente responde error, se avisa con su mensaje", async () => {
    setPrintAgentConfig({ url: "http://127.0.0.1:8787", key: "abc" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ status: "error", message: "printer not found" }) })
    );

    await expect(printTextToAgent({ printerName: "Nada", text: "x" })).rejects.toThrow("printer not found");
  });
});
