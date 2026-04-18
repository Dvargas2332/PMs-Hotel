/**
 * Generador de XML para Facturación Electrónica Costa Rica v4.4
 * Soporta: FE (01), ND (02), NC (03), TE (04)
 *
 * Referencia: Resolución DGT-R-48-2016 y esquemas XSD v4.4 de Hacienda CR
 */

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function padLeft(s: string, len: number, char = "0") {
  const str = String(s ?? "");
  if (str.length >= len) return str.slice(-len);
  return char.repeat(len - str.length) + str;
}

function formatDecimal(n: number | string | null | undefined, decimals = 5): string {
  const num = parseFloat(String(n ?? 0));
  return isNaN(num) ? "0.00000" : num.toFixed(decimals);
}

function formatMoney(n: number | string | null | undefined): string {
  return formatDecimal(n, 2);
}

function isoDateTime(d?: Date | string | null): string {
  if (!d) return new Date().toISOString();
  if (typeof d === "string") return d.includes("T") ? d : new Date(d).toISOString();
  return d.toISOString();
}

// ────────────────────────────────────────────────────────────────────────────
// Tipos de datos
// ────────────────────────────────────────────────────────────────────────────

export type CrDocType = "FE" | "ND" | "NC" | "TE";

// Códigos numéricos Hacienda según tipo
const DOC_CODE: Record<CrDocType, string> = {
  FE: "01",
  ND: "02",
  NC: "03",
  TE: "04",
};

export interface CrIssuer {
  name: string;           // Nombre o Razón Social
  idType: string;         // 01=física, 02=jurídica, 03=DIMEX, 04=NITE
  idNumber: string;       // Cédula sin guiones
  commercialName?: string;
  province?: string;
  canton?: string;
  district?: string;
  address?: string;
  phone?: string;
  email?: string;
  economicActivity?: string; // Código actividad BCCR
}

export interface CrReceiver {
  name: string;
  idType: string;
  idNumber: string;
  commercialName?: string;
  province?: string;
  canton?: string;
  district?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface CrLineItem {
  lineNumber: number;
  commercialCode?: string;        // Código producto/servicio
  cabysCode?: string;             // Código CABYS obligatorio
  qty: number;
  unitCode: string;               // Código unidad medida (Sp, m2, kg, etc.)
  unitCodeLabel?: string;
  description: string;
  unitPrice: number;
  discount?: number;
  discountReason?: string;
  subtotal: number;               // qty × unitPrice − descuento
  taxCode?: string;               // 01=IVA, etc.
  taxRate?: number;               // 13 para IVA 13%
  taxBase?: number;
  taxAmount?: number;
  exemptionType?: string;
  exemptionDoc?: string;
  exemptionInstitution?: string;
  exemptionDate?: string;
  exemptionPercent?: number;
  total: number;                  // subtotal + impuesto
}

export interface CrPayment {
  method: string;   // 01=Efectivo, 02=Tarjeta, 04=Transferencia, etc.
  amount: number;
  currency?: string;
  exchangeRate?: number;
  last4?: string;
  reference?: string;
}

export interface CrReference {
  docType: string;    // Tipo doc referenciado: 01,02,03,04
  key: string;        // Clave numérica del doc referenciado
  date: string;       // Fecha del doc referenciado ISO
  reason: string;     // Motivo (ej: "01" = anula doc referenciado)
}

export interface CrInvoiceInput {
  docType: CrDocType;
  key: string;
  consecutive: string;
  issueDate: Date | string;
  issuer: CrIssuer;
  receiver?: CrReceiver | null;
  currency: string;               // CRC, USD, EUR
  exchangeRate?: number;          // Solo si currency != CRC
  items: CrLineItem[];
  payments: CrPayment[];
  summary: {
    taxableServices: number;
    exemptServices: number;
    taxableGoods: number;
    exemptGoods: number;
    totalTaxableGoods: number;
    totalExemptGoods: number;
    totalTax: number;
    totalDiscount: number;
    totalVoucher: number;
    totalNetSale: number;
    totalTax2?: number;           // Impuesto 2 si aplica
    totalAmount: number;
  };
  references?: CrReference[];    // Para NC/ND: referencia al doc original
  condition?: string;             // 01=Contado, 02=Crédito
  creditTerms?: string;
  tip?: number;                   // 10% servicio restaurante
  notes?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Builder principal
// ────────────────────────────────────────────────────────────────────────────

function buildIssuerXml(issuer: CrIssuer): string {
  return `<Emisor>
    <Nombre>${esc(issuer.name)}</Nombre>
    <Identificacion>
      <Tipo>${esc(padLeft(issuer.idType, 2))}</Tipo>
      <Numero>${esc(issuer.idNumber.replace(/\D/g, ""))}</Numero>
    </Identificacion>
    ${issuer.commercialName ? `<NombreComercial>${esc(issuer.commercialName)}</NombreComercial>` : ""}
    ${issuer.province || issuer.canton || issuer.district || issuer.address ? `<Ubicacion>
      ${issuer.province ? `<Provincia>${esc(issuer.province)}</Provincia>` : ""}
      ${issuer.canton ? `<Canton>${esc(issuer.canton)}</Canton>` : ""}
      ${issuer.district ? `<Distrito>${esc(issuer.district)}</Distrito>` : ""}
      ${issuer.address ? `<OtrasSenas>${esc(issuer.address)}</OtrasSenas>` : ""}
    </Ubicacion>` : ""}
    ${issuer.phone ? `<Telefono><CodigoPais>506</CodigoPais><NumTelefono>${esc(issuer.phone)}</NumTelefono></Telefono>` : ""}
    ${issuer.email ? `<CorreoElectronico>${esc(issuer.email)}</CorreoElectronico>` : ""}
  </Emisor>`;
}

function buildReceiverXml(receiver: CrReceiver): string {
  return `<Receptor>
    <Nombre>${esc(receiver.name)}</Nombre>
    <Identificacion>
      <Tipo>${esc(padLeft(receiver.idType, 2))}</Tipo>
      <Numero>${esc(receiver.idNumber.replace(/\D/g, ""))}</Numero>
    </Identificacion>
    ${receiver.commercialName ? `<NombreComercial>${esc(receiver.commercialName)}</NombreComercial>` : ""}
    ${receiver.province || receiver.canton || receiver.district || receiver.address ? `<Ubicacion>
      ${receiver.province ? `<Provincia>${esc(receiver.province)}</Provincia>` : ""}
      ${receiver.canton ? `<Canton>${esc(receiver.canton)}</Canton>` : ""}
      ${receiver.district ? `<Distrito>${esc(receiver.district)}</Distrito>` : ""}
      ${receiver.address ? `<OtrasSenas>${esc(receiver.address)}</OtrasSenas>` : ""}
    </Ubicacion>` : ""}
    ${receiver.phone ? `<Telefono><CodigoPais>506</CodigoPais><NumTelefono>${esc(receiver.phone)}</NumTelefono></Telefono>` : ""}
    ${receiver.email ? `<CorreoElectronico>${esc(receiver.email)}</CorreoElectronico>` : ""}
  </Receptor>`;
}

function buildLineXml(item: CrLineItem): string {
  const hasTax = item.taxCode && (item.taxAmount ?? 0) > 0;
  return `<LineaDetalle>
    <NumeroLinea>${item.lineNumber}</NumeroLinea>
    ${item.cabysCode ? `<CodigoProducto>
      <Tipo>04</Tipo>
      <Codigo>${esc(item.cabysCode)}</Codigo>
    </CodigoProducto>` : ""}
    ${item.commercialCode ? `<CodigoProducto>
      <Tipo>01</Tipo>
      <Codigo>${esc(item.commercialCode)}</Codigo>
    </CodigoProducto>` : ""}
    <Cantidad>${formatDecimal(item.qty, 3)}</Cantidad>
    <UnidadMedida>${esc(item.unitCode || "Sp")}</UnidadMedida>
    ${item.unitCodeLabel ? `<UnidadMedidaComercial>${esc(item.unitCodeLabel)}</UnidadMedidaComercial>` : ""}
    <Detalle>${esc(item.description)}</Detalle>
    <PrecioUnitario>${formatDecimal(item.unitPrice, 5)}</PrecioUnitario>
    <MontoTotal>${formatMoney(item.qty * item.unitPrice)}</MontoTotal>
    ${(item.discount ?? 0) > 0 ? `<Descuento>
      <MontoDescuento>${formatMoney(item.discount)}</MontoDescuento>
      ${item.discountReason ? `<NaturalezaDescuento>${esc(item.discountReason)}</NaturalezaDescuento>` : ""}
    </Descuento>` : ""}
    <SubTotal>${formatMoney(item.subtotal)}</SubTotal>
    ${hasTax ? `<Impuesto>
      <Codigo>${esc(item.taxCode)}</Codigo>
      <CodigoTarifa>${item.taxRate === 13 ? "08" : item.taxRate === 4 ? "04" : item.taxRate === 2 ? "02" : item.taxRate === 1 ? "01" : "08"}</CodigoTarifa>
      <Tarifa>${formatDecimal(item.taxRate, 2)}</Tarifa>
      <FactorIVA>${formatDecimal((item.taxRate ?? 13) / 100, 5)}</FactorIVA>
      <Monto>${formatMoney(item.taxAmount)}</Monto>
      ${item.exemptionType ? `<Exoneracion>
        <TipoDocumento>${esc(item.exemptionType)}</TipoDocumento>
        <NumeroDocumento>${esc(item.exemptionDoc ?? "")}</NumeroDocumento>
        <NombreInstitucion>${esc(item.exemptionInstitution ?? "")}</NombreInstitucion>
        <FechaEmision>${esc(item.exemptionDate ?? new Date().toISOString())}</FechaEmision>
        <PorcentajeExoneracion>${formatDecimal(item.exemptionPercent ?? 100, 2)}</PorcentajeExoneracion>
        <MontoExoneracion>${formatMoney(((item.taxAmount ?? 0) * (item.exemptionPercent ?? 100)) / 100)}</MontoExoneracion>
      </Exoneracion>` : ""}
    </Impuesto>` : ""}
    <ImpuestoNeto>${formatMoney(hasTax ? item.taxAmount : 0)}</ImpuestoNeto>
    <MontoTotalLinea>${formatMoney(item.total)}</MontoTotalLinea>
  </LineaDetalle>`;
}

function buildPaymentXml(payment: CrPayment): string {
  return `<MedioPago>
    <CodigoTipoMedio>${esc(padLeft(payment.method, 2))}</CodigoTipoMedio>
    <Monto>${formatMoney(payment.amount)}</Monto>
    ${payment.currency ? `<TipoMoneda>
      <CodigoMoneda>${esc(payment.currency)}</CodigoMoneda>
      ${payment.exchangeRate ? `<TipoCambio>${formatDecimal(payment.exchangeRate, 5)}</TipoCambio>` : ""}
    </TipoMoneda>` : ""}
    ${payment.reference ? `<ReferenciaPago>${esc(payment.reference)}</ReferenciaPago>` : ""}
  </MedioPago>`;
}

function buildReferenceXml(ref: CrReference): string {
  return `<InformacionReferencia>
    <TipoDoc>${esc(padLeft(ref.docType, 2))}</TipoDoc>
    <Numero>${esc(ref.key)}</Numero>
    <FechaEmision>${esc(ref.date)}</FechaEmision>
    <Codigo>${esc(ref.reason)}</Codigo>
  </InformacionReferencia>`;
}

export function buildCrXml(input: CrInvoiceInput): string {
  const rootTag = input.docType === "TE" ? "TiqueteElectronico" : "FacturaElectronicaVenta";
  const docCode = DOC_CODE[input.docType];
  const s = input.summary;

  const linesXml = input.items.map(buildLineXml).join("\n");
  const paymentsXml = input.payments.map(buildPaymentXml).join("\n");
  const refsXml = (input.references ?? []).map(buildReferenceXml).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootTag} xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/${rootTag === "TiqueteElectronico" ? "tiqueteElectronico" : "facturaElectronicaVenta"}" xmlns:xs="http://www.w3.org/2001/XMLSchema-instance">
  <Clave>${esc(input.key)}</Clave>
  <CodigoActividad>${esc(input.issuer.economicActivity ?? "551001")}</CodigoActividad>
  <NumeroConsecutivo>${esc(input.consecutive)}</NumeroConsecutivo>
  <FechaEmision>${esc(isoDateTime(input.issueDate))}</FechaEmision>
  ${buildIssuerXml(input.issuer)}
  ${input.receiver ? buildReceiverXml(input.receiver) : ""}
  <CondicionVenta>${esc(input.condition ?? "01")}</CondicionVenta>
  ${input.creditTerms ? `<PlazoCredito>${esc(input.creditTerms)}</PlazoCredito>` : ""}
  <MedioPago>${paymentsXml}</MedioPago>
  <DetalleServicio>
    ${linesXml}
  </DetalleServicio>
  <ResumenFactura>
    <CodigoTipoMoneda>
      <CodigoMoneda>${esc(input.currency || "CRC")}</CodigoMoneda>
      <TipoCambio>${formatDecimal(input.exchangeRate ?? 1, 5)}</TipoCambio>
    </CodigoTipoMoneda>
    <TotalServGravados>${formatMoney(s.taxableServices)}</TotalServGravados>
    <TotalServExentos>${formatMoney(s.exemptServices)}</TotalServExentos>
    <TotalServExonerado>0.00</TotalServExonerado>
    <TotalMercanciasGravadas>${formatMoney(s.taxableGoods)}</TotalMercanciasGravadas>
    <TotalMercanciasExentas>${formatMoney(s.exemptGoods)}</TotalMercanciasExentas>
    <TotalMercExonerada>0.00</TotalMercExonerada>
    <TotalGravado>${formatMoney(s.totalTaxableGoods)}</TotalGravado>
    <TotalExento>${formatMoney(s.totalExemptGoods)}</TotalExento>
    <TotalExonerado>0.00</TotalExonerado>
    <TotalVenta>${formatMoney(s.totalNetSale + s.totalDiscount)}</TotalVenta>
    <TotalDescuentos>${formatMoney(s.totalDiscount)}</TotalDescuentos>
    <TotalVentaNeta>${formatMoney(s.totalNetSale)}</TotalVentaNeta>
    <TotalImpuesto>${formatMoney(s.totalTax)}</TotalImpuesto>
    ${(input.tip ?? 0) > 0 ? `<TotalIVADevuelto>0.00</TotalIVADevuelto>` : ""}
    <TotalOtrosCargos>0.00</TotalOtrosCargos>
    <TotalComprobante>${formatMoney(s.totalAmount)}</TotalComprobante>
  </ResumenFactura>
  ${refsXml}
  ${input.notes ? `<Otros><OtroTexto>${esc(input.notes)}</OtroTexto></Otros>` : ""}
</${rootTag}>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers para construir CrInvoiceInput desde datos del PMS
// ────────────────────────────────────────────────────────────────────────────

export function buildSummaryFromLines(items: CrLineItem[]): CrInvoiceInput["summary"] {
  let taxableServices = 0, exemptServices = 0, taxableGoods = 0, exemptGoods = 0;
  let totalTax = 0, totalDiscount = 0, totalNetSale = 0;

  for (const item of items) {
    const isTaxed = (item.taxAmount ?? 0) > 0;
    totalDiscount += item.discount ?? 0;
    totalTax += item.taxAmount ?? 0;
    totalNetSale += item.subtotal;
    // Clasificamos todo como servicio (hotelería/restaurante)
    if (isTaxed) taxableServices += item.subtotal;
    else exemptServices += item.subtotal;
  }

  const totalAmount = totalNetSale + totalTax;

  return {
    taxableServices,
    exemptServices,
    taxableGoods,
    exemptGoods,
    totalTaxableGoods: taxableServices + taxableGoods,
    totalExemptGoods: exemptServices + exemptGoods,
    totalTax,
    totalDiscount,
    totalVoucher: 0,
    totalNetSale,
    totalAmount,
  };
}

/**
 * Construye líneas de factura desde ítems del PMS (invoice.items o order.items).
 * pmsItems: array de { name, price, qty, cabysCode?, taxRate? }
 * taxRate: 13 por defecto (IVA Costa Rica)
 */
export function buildLinesFromPmsItems(
  pmsItems: Array<{
    name: string;
    price: number | string;
    qty: number;
    cabysCode?: string;
    commercialCode?: string;
    taxRate?: number;
    taxExempt?: boolean;
  }>,
  defaultTaxRate = 13
): CrLineItem[] {
  return pmsItems.map((item, idx) => {
    const unitPrice = parseFloat(String(item.price ?? 0));
    const qty = item.qty ?? 1;
    const discount = 0;
    const subtotal = qty * unitPrice - discount;
    const rate = item.taxExempt ? 0 : (item.taxRate ?? defaultTaxRate);
    const taxAmount = rate > 0 ? parseFloat((subtotal * rate / 100).toFixed(2)) : 0;
    const total = subtotal + taxAmount;

    return {
      lineNumber: idx + 1,
      cabysCode: item.cabysCode,
      commercialCode: item.commercialCode,
      qty,
      unitCode: "Sp",           // Sp = Servicios profesionales, común en hotelería/restaurante
      description: item.name,
      unitPrice,
      discount,
      subtotal,
      taxCode: rate > 0 ? "01" : undefined,   // 01 = IVA
      taxRate: rate > 0 ? rate : undefined,
      taxBase: rate > 0 ? subtotal : undefined,
      taxAmount: rate > 0 ? taxAmount : undefined,
      total,
    };
  });
}
