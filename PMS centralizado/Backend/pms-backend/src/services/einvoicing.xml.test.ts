import { describe, expect, it } from "vitest";
import {
  MAX_CR_XML_BYTES,
  assertSafeCrXml,
  parseCrEInvoiceXml,
} from "./einvoicing.xml.js";

const facturaElectronica = `<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronicaVenta xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaVenta">
  <Clave>50606112500310123456700100001010000000001199999999</Clave>
  <NumeroConsecutivo>00100001010000000001</NumeroConsecutivo>
  <FechaEmision>2026-11-06T10:00:00-06:00</FechaEmision>
  <Emisor>
    <Nombre>Hotel Prueba</Nombre>
    <Identificacion><Tipo>02</Tipo><Numero>3101234567</Numero></Identificacion>
    <CorreoElectronico>facturas@hotel.test</CorreoElectronico>
  </Emisor>
  <Receptor>
    <Nombre>Cliente Prueba</Nombre>
    <Identificacion><Tipo>01</Tipo><Numero>111111111</Numero></Identificacion>
  </Receptor>
  <DetalleServicio>
    <LineaDetalle>
      <NumeroLinea>1</NumeroLinea>
      <Detalle>Cena</Detalle>
      <MontoTotalLinea>11300.00</MontoTotalLinea>
    </LineaDetalle>
  </DetalleServicio>
  <ResumenFactura><TotalComprobante>11300.00</TotalComprobante></ResumenFactura>
</FacturaElectronicaVenta>`;

const tiqueteElectronico = `<?xml version="1.0" encoding="UTF-8"?>
<TiqueteElectronico>
  <Clave>50606112500310123456700100001010000000002199999999</Clave>
  <NumeroConsecutivo>00100001010000000002</NumeroConsecutivo>
  <Emisor><Nombre>Hotel Prueba</Nombre></Emisor>
</TiqueteElectronico>`;

describe("assertSafeCrXml", () => {
  it("acepta un comprobante normal", () => {
    expect(() => assertSafeCrXml(facturaElectronica)).not.toThrow();
  });

  it("rechaza un DOCTYPE con entidades (billion laughs)", () => {
    const bomba = `<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
]>
<TiqueteElectronico><Clave>&lol2;</Clave></TiqueteElectronico>`;

    expect(() => assertSafeCrXml(bomba)).toThrow(/DOCTYPE/i);
  });

  it("rechaza un ENTITY suelto sin DOCTYPE", () => {
    const xml = `<TiqueteElectronico><!ENTITY x "y"><Clave>1</Clave></TiqueteElectronico>`;
    expect(() => assertSafeCrXml(xml)).toThrow(/ENTITY|DOCTYPE/i);
  });

  it("no se deja engañar por espacios en la declaración", () => {
    const xml = `<TiqueteElectronico><Clave>1</Clave></TiqueteElectronico><!  DOCTYPE x [ ]>`;
    expect(() => assertSafeCrXml(xml)).toThrow(/DOCTYPE|ENTITY/i);
  });

  it("rechaza un XML por encima de 1 MB", () => {
    const relleno = "a".repeat(MAX_CR_XML_BYTES + 10);
    expect(() => assertSafeCrXml(`<TiqueteElectronico><Clave>${relleno}</Clave></TiqueteElectronico>`)).toThrow(/1 MB/);
  });

  it("rechaza cadena vacía", () => {
    expect(() => assertSafeCrXml("   ")).toThrow(/vacío/i);
  });
});

describe("parseCrEInvoiceXml", () => {
  it("extrae clave, consecutivo y emisor de una factura", () => {
    const parsed = parseCrEInvoiceXml(facturaElectronica);
    expect(parsed.docType).toBe("FE");
    expect(parsed.key).toBe("50606112500310123456700100001010000000001199999999");
    expect(parsed.consecutive).toBe("00100001010000000001");
    expect(parsed.emitter?.name).toBe("Hotel Prueba");
    expect(parsed.receiver?.id).toBe("111111111");
    expect(parsed.lines).toHaveLength(1);
  });

  it("detecta el tiquete electrónico", () => {
    const parsed = parseCrEInvoiceXml(tiqueteElectronico);
    expect(parsed.docType).toBe("TE");
    expect(parsed.consecutive).toBe("00100001010000000002");
  });

  it("corta antes de parsear si el XML trae DOCTYPE", () => {
    const bomba = `<!DOCTYPE x [<!ENTITY a "b">]><TiqueteElectronico><Clave>1</Clave></TiqueteElectronico>`;
    expect(() => parseCrEInvoiceXml(bomba)).toThrow(/DOCTYPE/i);
  });
});
