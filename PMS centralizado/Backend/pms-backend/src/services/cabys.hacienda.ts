/**
 * Integración con la API pública de CABYS del Ministerio de Hacienda CR
 * Documentación: https://api.hacienda.go.cr/fe/cabys
 *
 * Endpoints relevantes:
 *   GET https://api.hacienda.go.cr/fe/cabys?q=<texto>&top=<n>   → búsqueda de códigos
 *   GET https://api.hacienda.go.cr/fe/cabys?codigo=<código>     → por código exacto
 */

const HACIENDA_CABYS_BASE = "https://api.hacienda.go.cr/fe/cabys";

export interface HaciendaCabysItem {
  codigo: string;
  descripcion: string;
  impuesto?: number;  // tasa IVA (0, 1, 2, 4, 8, 13...)
  categorias?: string[];
}

interface HaciendaCabysResponse {
  cabys?: HaciendaCabysItem[];
  // A veces la API devuelve array directo
  [key: string]: any;
}

/**
 * Busca códigos CABYS en la API de Hacienda.
 * @param q  texto a buscar (descripción o código parcial)
 * @param top número máximo de resultados (default 20, max 500)
 */
export async function searchCabysHacienda(
  q: string,
  top = 20
): Promise<HaciendaCabysItem[]> {
  const params = new URLSearchParams({ q: q.trim(), top: String(Math.min(top, 500)) });
  const url = `${HACIENDA_CABYS_BASE}?${params}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Hacienda CABYS API error ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = (await res.json()) as HaciendaCabysResponse | HaciendaCabysItem[];

  // La API puede devolver { cabys: [...] } o el array directamente
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.cabys)) return data.cabys;

  // A veces viene como objeto con claves numéricas
  const values = Object.values(data);
  if (values.length > 0 && typeof values[0] === "object") {
    return values as HaciendaCabysItem[];
  }

  return [];
}

/**
 * Obtiene un código CABYS exacto por su código numérico.
 */
export async function getCabysHacienda(
  codigo: string
): Promise<HaciendaCabysItem | null> {
  const params = new URLSearchParams({ codigo: codigo.trim() });
  const url = `${HACIENDA_CABYS_BASE}?${params}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Hacienda CABYS API error ${res.status}`);
  }

  const data = (await res.json()) as any;

  if (Array.isArray(data) && data.length > 0) return data[0];
  if (Array.isArray(data?.cabys) && data.cabys.length > 0) return data.cabys[0];
  if (data?.codigo) return data as HaciendaCabysItem;

  return null;
}

/**
 * Descarga un lote de CABYS desde Hacienda por búsqueda y los normaliza
 * en el formato que usa nuestro modelo CabysCode (id, description).
 *
 * Se usa para sincronización masiva desde el panel de administración.
 */
export async function fetchCabysPage(
  q: string,
  top = 500
): Promise<Array<{ id: string; description: string; taxRate: number }>> {
  const items = await searchCabysHacienda(q, top);
  return items.map((it) => ({
    id: String(it.codigo),
    description: String(it.descripcion),
    taxRate: typeof it.impuesto === "number" ? it.impuesto : 13,
  }));
}
