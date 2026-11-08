//src/pages/Management/AuditLog.jsx

import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { CustomSelect } from "../../components/ui/CustomSelect";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";

const MODULE_LABELS = {
  frontdesk:       "Front Desk",
  restaurant:      "Restaurante",
  accounting:      "Contabilidad",
  einvoicing:      "Facturación Electrónica",
  channel_manager: "Channel Manager",
  management:      "Management",
};

// Fecha con guiones (dd-mm-yyyy hh:mm), no con barras.
function formatStamp(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()} ${hh}:${mi}`;
}

// Color por tipo de tarea, para leer la bitácora de un vistazo.
function actionDot(action) {
  const raw = String(action || "").trim();
  const a = raw.toLowerCase();
  if (raw.startsWith("FAILED_") || a.includes("error")) return "#e11d48";
  if (a.startsWith("elimin") || a.startsWith("anul")) return "#dc2626";
  if (a.startsWith("cre") || a.startsWith("cobr") || a.startsWith("cerr")) return "#059669";
  if (a.startsWith("modific") || a.startsWith("guard") || a.startsWith("movi") || a.startsWith("envi") || a.startsWith("reenvi")) return "#4f46e5";
  if (a.startsWith("inici") || a.startsWith("abri") || a.startsWith("import") || a.startsWith("restablec")) return "#0284c7";
  return "#94a3b8";
}

// Filas viejas escritas antes de este cambio: eran errores del sistema y no
// tareas, así que no se muestran aunque sigan en la base.
function isSystemNoise(action) {
  return String(action || "").startsWith("FAILED_");
}

export default function AuditLog() {
  const { t } = useLanguage();
  const { hotel } = useAuth();
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [module, setModule] = useState("");
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const moduleOptions = useMemo(() => {
    const allowed = hotel?.allowedModules;
    const all = Object.keys(MODULE_LABELS);
    const active = Array.isArray(allowed) && allowed.length > 0
      ? all.filter((m) => allowed.map((a) => String(a).toLowerCase()).includes(m))
      : all;
    return [
      { value: "", label: t("mgmt.audit.allModules") || "Todos los módulos" },
      ...active.map((m) => ({ value: m, label: MODULE_LABELS[m] || m })),
    ];
  }, [hotel?.allowedModules, t]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/audit");
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (isSystemNoise(r.action)) return false;
      const matchesText = !module || String(r.module || "").toLowerCase() === module.toLowerCase();
      const matchesUser = !user || String(r.userId || "").toLowerCase().includes(user.toLowerCase());

      if (!matchesText || !matchesUser) return false;

      if (from) {
        const ts = new Date(r.timestamp || r.at || 0).getTime();
        const fromTs = new Date(from).getTime();
        if (ts && ts < fromTs) return false;
      }
      if (to) {
        const ts = new Date(r.timestamp || r.at || 0).getTime();
        const toTs = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1;
        if (ts && ts > toTs) return false;
      }
      return true;
    });
  }, [rows, module, user, from, to]);

  return (
    <div className="space-y-3 mx-auto w-full max-w-5xl">
      <div>
        <div className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          {t("mgmt.shell.menu.auditTitle") || "Auditoría"}
        </div>
        <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-base)" }}>
          {t("mgmt.shell.menu.auditItem") || "Bitácora"}
        </h3>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Quién cambió qué y cuándo. Los registros se escriben solos con cada acción dentro del hotel.
        </p>
      </div>

      {/* Filtros en una sola fila */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-48">
          <div className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.audit.columns.module")}</div>
          <CustomSelect className="w-full" value={module} onChange={e => setModule(e.target.value)} options={moduleOptions} placeholder={t("mgmt.audit.allModules") || "Todos los módulos"} />
        </div>
        <div className="w-44">
          <div className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.audit.columns.user")}</div>
          <Input placeholder={t("mgmt.audit.userPlaceholder")} value={user} onChange={e => setUser(e.target.value)} />
        </div>
        <div className="w-36">
          <div className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>Desde</div>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="w-36">
          <div className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>Hasta</div>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>{loading ? t("common.loading") : t("mgmt.audit.search")}</Button>
          <Button variant="ghost" onClick={() => { setModule(""); setUser(""); setFrom(""); setTo(""); }}>{t("common.clear")}</Button>
        </div>
      </div>

      {rows === null ? (
        <div className="py-16 text-center text-sm rounded-xl border border-dashed" style={{ color: "var(--color-text-muted)", borderColor: "var(--card-border)" }}>
          {t("mgmt.audit.emptyPrompt") || "Presiona Buscar para ver los registros."}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm rounded-xl border border-dashed" style={{ color: "var(--color-text-muted)", borderColor: "var(--card-border)" }}>
          No hay movimientos con esos filtros.
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--card-border)" }}>
                <th className="text-left font-semibold px-3 py-2 w-8">#</th>
                <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">{t("mgmt.audit.columns.date")}</th>
                <th className="text-left font-semibold px-3 py-2">{t("mgmt.audit.columns.module")}</th>
                <th className="text-left font-semibold px-3 py-2">{t("mgmt.audit.columns.action")}</th>
                <th className="text-left font-semibold px-3 py-2">{t("mgmt.audit.columns.entity")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const action = r.action || r.task || r.description || "—";
                return (
                  <tr key={r.id || idx} className="transition-colors hover:bg-white/5" style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <td className="px-3 py-2 tabular-nums text-xs align-middle" style={{ color: "var(--color-text-muted)" }}>{idx + 1}</td>
                    <td className="px-3 py-2 align-middle whitespace-nowrap text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                      {formatStamp(r.timestamp || r.at)}
                    </td>
                    <td className="px-3 py-2 align-middle text-xs whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
                      {MODULE_LABELS[String(r.module || "").toLowerCase()] || r.module || "—"}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: actionDot(action) }} />
                        <span className="font-semibold whitespace-nowrap" style={{ color: "var(--color-text-base)" }}>
                          {r.userId || "—"}
                        </span>
                        <span style={{ color: "var(--color-text-muted)" }}>· {action}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 align-middle text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {r.entityType || r.entity || "—"}
                      {r.entityId ? <span className="opacity-60"> · {r.entityId}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows !== null && (
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {filtered.length} de {rows.length} movimientos
        </div>
      )}
    </div>
  );
}
