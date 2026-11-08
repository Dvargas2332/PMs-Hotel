import React, { useMemo, useState } from "react";
import { Info, Search, X, MessageCircle, ChevronDown, Mail } from "lucide-react";
import { HELP_FAQ } from "../lib/helpFaq";
import { buildWhatsAppUrl, buildEmailUrl, SUPPORT_WHATSAPP, SUPPORT_EMAIL } from "../lib/support";

/**
 * Panel de ayuda y soporte. Ventana flotante centrada, igual que el resto de
 * los paneles del PMS: buscador, preguntas frecuentes y salida a WhatsApp.
 * No depende de ninguna cuenta ni servicio externo; si falta el número de
 * WhatsApp en el .env, se muestra sólo el FAQ.
 */
export default function HelpPanel({ open, onClose, contextLabel }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_FAQ;
    return HELP_FAQ.filter((f) => `${f.q} ${f.a} ${f.tag || ""}`.toLowerCase().includes(q));
  }, [query]);

  if (!open) return null;

  const waUrl = buildWhatsAppUrl(
    `Hola, necesito soporte del PMS${contextLabel ? ` (${contextLabel})` : ""}.`
  );
  const mailUrl = buildEmailUrl(
    `Soporte PMS${contextLabel ? ` — ${contextLabel}` : ""}`,
    `Hola, necesito soporte del PMS.\n\nHotel: ${contextLabel || "-"}\nDetalle: `
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 md:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 flex flex-col w-full max-w-[min(94vw,720px)] max-h-[86vh] rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--color-text-base)" }}>Ayuda y soporte</div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Buscá tu caso o escribinos por WhatsApp o correo
              </div>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: "var(--color-text-muted)" }}
            onClick={onClose}
            aria-label="Cerrar ayuda"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Buscador */}
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--card-border)" }}>
          <div className="flex items-center gap-2 rounded-xl px-3 h-10" style={{ background: "var(--input-bg, var(--card-bg))", border: "1px solid var(--input-border, var(--card-border))" }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
            <input
              className="w-full bg-transparent outline-none text-sm"
              style={{ color: "var(--color-text-base)" }}
              placeholder="Ej: no imprime, cerrar turno, invitar usuario…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="text-xs shrink-0"
                style={{ color: "var(--color-text-muted)" }}
                onClick={() => setQuery("")}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Preguntas */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-14 px-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
              No encontramos nada con «{query}».{SUPPORT_WHATSAPP ? " Escribinos por WhatsApp y lo vemos." : ""}
            </div>
          ) : (
            <ul>
              {items.map((item) => {
                const isOpen = expanded === item.id;
                return (
                  <li key={item.id} style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <button
                      className="w-full flex items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      aria-expanded={isOpen}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium" style={{ color: "var(--color-text-base)" }}>{item.q}</div>
                        {item.tag && (
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{item.tag}</div>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        style={{ color: "var(--color-text-muted)" }}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 -mt-1">
                        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{item.a}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pie: canales de contacto */}
        <div className="px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: "1px solid var(--card-border)" }}>
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {SUPPORT_WHATSAPP || SUPPORT_EMAIL ? "El mensaje sale con el nombre del hotel." : "Canales de soporte no configurados."}
          </div>
          <div className="flex items-center gap-2">
            {SUPPORT_EMAIL && (
              <a
                href={mailUrl}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                style={{ color: "var(--color-text-base)", border: "1px solid var(--card-border)" }}
              >
                <Mail className="w-4 h-4" />
                Escribir por correo
              </a>
            )}
            {SUPPORT_WHATSAPP && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Escribir por WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
