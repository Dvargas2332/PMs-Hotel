// Canal de soporte del PMS.
//
// Los datos van como valor por defecto para que funcionen también en el build de
// producción sin depender de variables del workflow. Se pueden pisar desde el
// .env del front:
//   VITE_SUPPORT_WHATSAPP=50600000000   (sin + ni guiones)
//   VITE_SUPPORT_EMAIL=soporte@dominio.com

const DEFAULT_WHATSAPP = "50689641604";
const DEFAULT_EMAIL = "soporte@kazehanacloud.com";

export const SUPPORT_WHATSAPP = String(import.meta.env.VITE_SUPPORT_WHATSAPP || DEFAULT_WHATSAPP)
  .replace(/[^\d]/g, "");

export const SUPPORT_EMAIL = String(import.meta.env.VITE_SUPPORT_EMAIL || DEFAULT_EMAIL).trim();

export function buildWhatsAppUrl(message) {
  if (!SUPPORT_WHATSAPP) return "";
  const text = encodeURIComponent(String(message || ""));
  return `https://wa.me/${SUPPORT_WHATSAPP}${text ? `?text=${text}` : ""}`;
}

export function buildEmailUrl(subject, body) {
  if (!SUPPORT_EMAIL) return "";
  const params = new URLSearchParams();
  if (subject) params.set("subject", String(subject));
  if (body) params.set("body", String(body));
  const query = params.toString();
  return `mailto:${SUPPORT_EMAIL}${query ? `?${query}` : ""}`;
}
