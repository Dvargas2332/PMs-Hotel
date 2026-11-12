/**
 * Rutas que existen en el backend real.
 *
 * Todo lo que no esté aquí se responde con el mock de `lib/mock.js`, que
 * devuelve `null`, y la pantalla queda vacía sin ningún error: así se quedó
 * contabilidad sin cargar asientos, cuentas ni configuración.
 */
export const BACKEND_PREFIXES = [
  "/auth",
  "/launcher",
  "/gestor",
  "/settings",
  "/reservations",
  "/rooms",
  "/roomTypes",
  "/ratePlans",
  "/mealPlans",
  "/contracts",
  "/guests",
  "/hotel",
  "/health",
  "/version",
  "/roles",
  "/permissions",
  "/audit",
  "/taxes",
  "/restaurant",
  "/invoices",
  "/einvoicing",
  "/accounting",
  "/geo",
  "/cash-audits",
];

export const shouldUseBackend = (path) => BACKEND_PREFIXES.some((p) => path.startsWith(p));
