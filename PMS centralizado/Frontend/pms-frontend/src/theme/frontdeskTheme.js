// Paleta centralizada para Frontdesk (dashboard, planning, reservas)

export const frontdeskTheme = {
  // Fondos
  background: {
    app: "#F3F4F6", // fondo general
    surface: "#FFFFFF", // tarjetas
    surfaceSoft: "#F8FAFC", // paneles grandes
  },

  // Texto y bordes
  text: {
    primary: "#0F172A",
    secondary: "#64748B",
  },

  border: {
    soft: "#E5E7EB",
  },

  // Identidad frontdesk (relacionado al logo)
  primary: {
    base: "#059669",
    hover: "#047857",
    subtle: "#ECFDF5",
  },
  secondary: {
    base: "#0EA5E9",
    hover: "#0284C7",
    subtle: "#E0F2FE",
  },

  // Estados
  states: {
    success: { bg: "#ECFDF5", fg: "#16A34A" },
    info: { bg: "#E0F2FE", fg: "#0EA5E9" },
    warning: { bg: "#FEF3C7", fg: "#F59E0B" },
    danger: { bg: "#FEE2E2", fg: "#DC2626" },
    waitlist: { bg: "#F5F3FF", fg: "#7C3AED" },
  },

  // Planning
  planning: {
    headerGradient: "linear-gradient(90deg, #059669, #0EA5E9)",
    roomTypeRowBg: "#D1FAE5",
    roomTypeRowFg: "#065F46",
    roomTypeRowBorder: "#A7F3D0",
    cellBg: "#F9FAFB",
    cellBorder: "#E5E7EB",
  },
};

export default frontdeskTheme;

