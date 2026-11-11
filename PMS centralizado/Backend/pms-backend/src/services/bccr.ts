// src/services/bccr.ts
//
// Tipo de cambio de referencia del Banco Central de Costa Rica.
//
// El BCCR publica los indicadores por un servicio SOAP que exige un correo y un
// token gratuitos (registro en "Indicadores económicos"). Se piden dos:
//   317 = tipo de cambio compra
//   318 = tipo de cambio venta
// El servicio devuelve un XML con otro XML escapado adentro; el valor se toma
// del último registro (el más reciente) de cada indicador.

// El BCCR ha movido este servicio varias veces: la dirección se deja en
// BCCR_ENDPOINT para poder corregirla sin tocar el código. El correo de
// registro de "Indicadores económicos" trae la dirección vigente.
const BCCR_ENDPOINT =
  process.env.BCCR_ENDPOINT ||
  "https://gee.bccr.fi.cr/IndicadoresEconomicos/WebServices/wsIndicadoresEconomicos.asmx";

export type BccrRate = { buy: number; sell: number; date: string | null };

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

function soapBody(indicator: string, from: string, to: string, email: string, token: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ObtenerIndicadoresEconomicosXML xmlns="http://ws.sdde.bccr.fi.cr">
      <Indicador>${indicator}</Indicador>
      <FechaInicio>${from}</FechaInicio>
      <FechaFinal>${to}</FechaFinal>
      <Nombre>Kazehana PMS</Nombre>
      <SubNiveles>N</SubNiveles>
      <CorreoElectronico>${email}</CorreoElectronico>
      <Token>${token}</Token>
    </ObtenerIndicadoresEconomicosXML>
  </soap:Body>
</soap:Envelope>`;
}

/** Saca el último NUM_VALOR y su fecha del XML (escapado o no) que devuelve el BCCR. */
function parseIndicator(xml: string): { value: number; date: string | null } | null {
  const unescaped = xml
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

  const rows = [...unescaped.matchAll(/<NUM_VALOR>([\d.,-]+)<\/NUM_VALOR>/g)];
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  const value = Number(String(last[1]).replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;

  const dates = [...unescaped.matchAll(/<DES_FECHA>([^<]+)<\/DES_FECHA>/g)];
  const date = dates.length > 0 ? String(dates[dates.length - 1][1]).trim() : null;
  return { value, date };
}

async function fetchIndicator(indicator: "317" | "318", email: string, token: string) {
  const today = new Date();
  const from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(BCCR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "http://ws.sdde.bccr.fi.cr/ObtenerIndicadoresEconomicosXML" },
      body: soapBody(indicator, fmtDate(from), fmtDate(today), email, token),
      signal: controller.signal,
    });
    const text = await res.text();
    if (res.status === 404) {
      throw new Error(
        "El BCCR no tiene el servicio en la dirección configurada. Revisá la dirección que viene en el correo de registro de Indicadores económicos."
      );
    }
    if (!res.ok) {
      throw new Error(`El BCCR respondió ${res.status}. Revisá el correo y el token.`);
    }
    // El BCCR contesta 200 con un mensaje de error en texto cuando el token no sirve.
    if (/token|correo/i.test(text) && !/<NUM_VALOR>/.test(text.replace(/&lt;/g, "<"))) {
      throw new Error("El BCCR rechazó el correo o el token.");
    }
    const parsed = parseIndicator(text);
    if (!parsed) throw new Error("El BCCR no devolvió un tipo de cambio para estos días.");
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

/** Devuelve compra y venta del dólar según el BCCR. */
export async function fetchBccrExchangeRate(email: string, token: string): Promise<BccrRate> {
  const buy = await fetchIndicator("317", email, token);
  const sell = await fetchIndicator("318", email, token);
  return { buy: buy.value, sell: sell.value, date: buy.date || sell.date };
}
