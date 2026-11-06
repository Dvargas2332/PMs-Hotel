//src/pages/Management/AuditLog.jsx

import React, { useEffect, useMemo, useState } from "react";
import { SimpleTable } from "../../components/ui/table";
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

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
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
        const toTs = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1; // end of day
        if (ts && ts > toTs) return false;
      }
      return true;
    });
  }, [rows, module, user, from, to]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <CustomSelect className="w-full" value={module} onChange={e => setModule(e.target.value)} options={moduleOptions} placeholder={t("mgmt.audit.allModules") || "Todos los módulos"} />
        <Input placeholder={t("mgmt.audit.userPlaceholder")} value={user} onChange={e=>setUser(e.target.value)} />
        <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={e=>setTo(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" className="w-full" onClick={load} disabled={loading}>{loading ? t("common.loading") : t("mgmt.audit.search")}</Button>
          <Button variant="ghost" className="w-full" onClick={()=>{ setModule(""); setUser(""); setFrom(""); setTo(""); setRows(null); }}>{t("common.clear")}</Button>
        </div>
      </div>

      {rows === null ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: "var(--color-text-muted)" }}>
          <span className="text-4xl">🔍</span>
          <p className="text-sm">{t("mgmt.audit.emptyPrompt") || "Aplica un filtro o presiona Buscar para ver los registros."}</p>
        </div>
      ) : (
      <SimpleTable
        cols={[
          {key:"timestamp", label:t("mgmt.audit.columns.date")},
          {key:"userId", label:t("mgmt.audit.columns.user")},
          {key:"module", label:t("mgmt.audit.columns.module")},
          {key:"action", label:t("mgmt.audit.columns.action")},
          {key:"entityType", label:t("mgmt.audit.columns.entity")},
          {key:"entityId", label:"ID"},
          {key:"reason", label:t("mgmt.audit.columns.details")}
        ]}
        rows={(filtered || []).map((r)=>({
          ...r,
          timestamp: r.timestamp ? new Date(r.timestamp).toLocaleString() : r.at || "",
          action: r.action || r.task || r.description,
          reason: r.reason || r.detail || "",
        }))}
      />
      )}
    </div>
  );
}
