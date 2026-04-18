import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  BookOpen,
  BarChart2,
  Settings,
  List,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Plus,
  Eye,
  TrendingUp,
  Scale,
  FileText,
  Layers,
  CircleUser,
  LogOut,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n ?? 0).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BADGE = {
  DRAFT: "bg-slate-500/20 text-slate-300",
  PENDING: "bg-yellow-500/20 text-yellow-300",
  POSTED: "bg-emerald-500/20 text-emerald-300",
  VOIDED: "bg-red-500/20 text-red-400",
};

const ACCOUNT_TYPE_COLORS = {
  ASSET: "text-sky-400",
  LIABILITY: "text-orange-400",
  EQUITY: "text-amber-400",
  INCOME: "text-emerald-400",
  EXPENSE: "text-red-400",
  COST: "text-amber-400",
};

// ─── Nav sidebar items ─────────────────────────────────────────────────────────
const NAV = [
  { id: "journal", label: "Libro Diario", icon: BookOpen },
  { id: "chart", label: "Plan de Cuentas", icon: Layers },
  { id: "ledger", label: "Mayor de Cuentas", icon: List },
  { id: "reports", label: "Reportes", icon: BarChart2 },
  { id: "settings", label: "Configuración", icon: Settings },
];

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function AccountingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [panel, setPanel] = React.useState("journal");
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e) => {
      if (!e.target.closest("[data-usermenu]")) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  const handleLogout = () => { navigate("/launcher"); };

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background: "var(--shell-bg)",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 backdrop-blur-sm" style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-3">
          <img src="/kazehanalogo.png" alt="Kazehana Cloud" className="h-8 w-8 object-contain" />
          <div className="space-y-0.5">
            <div className="text-xs uppercase tracking-wide text-amber-400">Módulo Contable</div>
            <div className="text-sm font-semibold text-white">Contabilidad</div>
          </div>
        </div>
        <div className="relative" data-usermenu>
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/5 dark:bg-white/10 dark:hover:bg-white/20 text-sm transition-colors"
            style={{ color: "var(--color-text-base)" }}
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            <CircleUser className="w-5 h-5 text-slate-300" />
            <div className="text-left text-sm leading-tight">
              <div className="font-medium text-white">{user?.name || user?.email || "Usuario"}</div>
              <div className="text-xs text-slate-400">{user?.role || "Contabilidad"}</div>
            </div>
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 shadow-xl rounded-2xl overflow-hidden z-50" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="px-3 py-2 text-sm" style={{ borderBottom: "1px solid var(--card-border)" }}>
                <div className="font-semibold" style={{ color: "var(--color-text-base)" }}>{user?.name || "Usuario"}</div>
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.email || user?.role || ""}</div>
              </div>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                style={{ color: "var(--color-text-muted)" }}
                onClick={() => { setUserMenuOpen(false); handleLogout(); }}
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span>{t("common.logout")}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 flex flex-col overflow-hidden" style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}>
          {/* Logo grande */}
          <div className="flex items-center justify-center py-6" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
            <img src="/kazehanalogo.png" alt="Kazehana Cloud" className="h-24 w-24 object-contain" />
          </div>
          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPanel(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  panel === id
                    ? "bg-amber-500/20 text-amber-300 shadow shadow-amber-900/40"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={panel !== id ? { color: "var(--color-text-muted)" } : {}}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
          {/* Footer logo */}
          <div className="flex items-center gap-3 px-4 py-4 shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
            <img src="/kazehanalogo.png" alt="Kazehana Cloud" className="h-10 w-10 object-contain opacity-70" />
            <div>
              <div className="text-sm font-semibold leading-tight" style={{ color: "var(--color-text-base)" }}>Kazehana PMS</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Módulo Contable</div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {panel === "journal" && <JournalPanel />}
          {panel === "chart" && <ChartOfAccountsPanel />}
          {panel === "ledger" && <LedgerPanel />}
          {panel === "reports" && <ReportsPanel />}
          {panel === "settings" && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
}

// ─── Panel: Libro Diario ───────────────────────────────────────────────────────
function JournalPanel() {
  const [entries, setEntries] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState({ status: "", source: "", q: "", from: "", to: "" });
  const [offset, setOffset] = React.useState(0);
  const [selected, setSelected] = React.useState(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const LIMIT = 25;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset });
      if (filters.status) params.set("status", filters.status);
      if (filters.source) params.set("source", filters.source);
      if (filters.q) params.set("q", filters.q);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const { data } = await api.get(`/accounting/entries?${params}`);
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  React.useEffect(() => { load(); }, [load]);

  const handlePost = async (id) => {
    await api.post(`/accounting/entries/${id}/post`);
    load();
  };
  const handleVoid = async (id) => {
    if (!window.confirm("¿Anular este asiento?")) return;
    await api.post(`/accounting/entries/${id}/void`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" /> Libro Diario
        </h2>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo Asiento
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Buscar..."
          value={filters.q}
          onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setOffset(0); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-44"
        />
        <select
          value={filters.status}
          onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setOffset(0); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="PENDING">Pendiente</option>
          <option value="POSTED">Contabilizado</option>
          <option value="VOIDED">Anulado</option>
        </select>
        <select
          value={filters.source}
          onChange={(e) => { setFilters((f) => ({ ...f, source: e.target.value })); setOffset(0); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">Todas las fuentes</option>
          <option value="MANUAL">Manual</option>
          <option value="EINVOICING">Facturación</option>
          <option value="RESTAURANT">Restaurante</option>
          <option value="FRONTDESK">Recepción</option>
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => { setFilters((f) => ({ ...f, from: e.target.value })); setOffset(0); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => { setFilters((f) => ({ ...f, to: e.target.value })); setOffset(0); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={load}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Número</th>
              <th className="text-left px-4 py-3">Fecha</th>
              <th className="text-left px-4 py-3">Descripción</th>
              <th className="text-left px-4 py-3">Fuente</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="text-right px-4 py-3">Débito</th>
              <th className="text-center px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500">
                  No hay asientos contables
                </td>
              </tr>
            )}
            {entries.map((e) => {
              const totalDebit = (e.lines ?? []).reduce((s, l) => s + Number(l.debit ?? 0), 0);
              return (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 font-mono text-amber-300 text-xs">{e.number}</td>
                  <td className="px-4 py-3 text-slate-300">{new Date(e.date).toLocaleDateString("es-CR")}</td>
                  <td className="px-4 py-3 text-white max-w-xs truncate">{e.description}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{e.source}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[e.status] ?? ""}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">₡{fmt(totalDebit)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setSelected(e)}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {(e.status === "DRAFT" || e.status === "PENDING") && (
                        <button
                          onClick={() => handlePost(e.id)}
                          className="p-1 rounded hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors"
                          title="Contabilizar"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {e.status !== "VOIDED" && (
                        <button
                          onClick={() => handleVoid(e.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title="Anular"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{total} asiento(s) en total</span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
            className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            ← Anterior
          </button>
          <button
            disabled={offset + LIMIT >= total}
            onClick={() => setOffset((o) => o + LIMIT)}
            className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Entry detail modal */}
      {selected && <EntryDetailModal entry={selected} onClose={() => setSelected(null)} />}

      {/* Create entry modal */}
      {createOpen && <CreateEntryModal onClose={() => { setCreateOpen(false); load(); }} />}
    </div>
  );
}

// ─── Entry Detail Modal ────────────────────────────────────────────────────────
function EntryDetailModal({ entry, onClose }) {
  const totalDebit = (entry.lines ?? []).reduce((s, l) => s + Number(l.debit ?? 0), 0);
  const totalCredit = (entry.lines ?? []).reduce((s, l) => s + Number(l.credit ?? 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <div className="text-xs text-amber-400 font-mono">{entry.number}</div>
            <div className="text-white font-semibold">{entry.description}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div><span className="text-slate-500">Fecha: </span><span className="text-white">{new Date(entry.date).toLocaleDateString("es-CR")}</span></div>
            <div><span className="text-slate-500">Fuente: </span><span className="text-slate-300">{entry.source}</span></div>
            <div><span className="text-slate-500">Estado: </span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[entry.status] ?? ""}`}>{entry.status}</span></div>
            {entry.currency && <div><span className="text-slate-500">Moneda: </span><span className="text-slate-300">{entry.currency}</span></div>}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-xs uppercase">
                <th className="text-left py-2">Cuenta</th>
                <th className="text-right py-2">Débito</th>
                <th className="text-right py-2">Crédito</th>
              </tr>
            </thead>
            <tbody>
              {(entry.lines ?? []).map((l) => (
                <tr key={l.id} className="border-b border-white/5">
                  <td className="py-2 text-white">
                    <span className="font-mono text-xs text-slate-400 mr-2">{l.account?.code}</span>
                    {l.account?.name}
                    {l.description && <div className="text-xs text-slate-500 mt-0.5">{l.description}</div>}
                  </td>
                  <td className="py-2 text-right font-mono text-slate-300">{Number(l.debit) > 0 ? `₡${fmt(l.debit)}` : ""}</td>
                  <td className="py-2 text-right font-mono text-slate-300">{Number(l.credit) > 0 ? `₡${fmt(l.credit)}` : ""}</td>
                </tr>
              ))}
              <tr className="border-t border-white/20 font-semibold text-white">
                <td className="py-2 text-slate-400 text-xs">TOTALES</td>
                <td className="py-2 text-right font-mono">₡{fmt(totalDebit)}</td>
                <td className="py-2 text-right font-mono">₡{fmt(totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Create Entry Modal ────────────────────────────────────────────────────────
function CreateEntryModal({ onClose }) {
  const [accounts, setAccounts] = React.useState([]);
  const [form, setForm] = React.useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    currency: "CRC",
  });
  const [lines, setLines] = React.useState([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" },
  ]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    api.get("/accounting/accounts?active=true").then(({ data }) => setAccounts(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const setLine = (i, field, val) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));

  const addLine = () => setLines((ls) => [...ls, { accountId: "", debit: "", credit: "", description: "" }]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSave = async () => {
    setError("");
    if (!form.date || !form.description) return setError("Fecha y descripción son requeridos");
    const validLines = lines.filter((l) => l.accountId);
    if (validLines.length < 2) return setError("Se requieren al menos 2 líneas");
    if (!balanced) return setError(`Asiento desbalanceado: Débito ${fmt(totalDebit)} ≠ Crédito ${fmt(totalCredit)}`);
    setSaving(true);
    try {
      await api.post("/accounting/entries", {
        ...form,
        lines: validLines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit || 0), credit: Number(l.credit || 0), description: l.description || null })),
      });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message ?? "Error al crear asiento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="text-white font-semibold">Nuevo Asiento Manual</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Moneda</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="CRC">CRC — Colón</option>
                <option value="USD">USD — Dólar</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Descripción</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Concepto del asiento..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Líneas</label>
              <button onClick={addLine} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Agregar línea
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-5">
                    <select
                      value={line.accountId}
                      onChange={(e) => setLine(i, "accountId", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Seleccionar cuenta...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Débito"
                      value={line.debit}
                      onChange={(e) => setLine(i, "debit", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Crédito"
                      value={line.credit}
                      onChange={(e) => setLine(i, "credit", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      placeholder="Nota"
                      value={line.description}
                      onChange={(e) => setLine(i, "description", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 2 && (
                      <button onClick={() => removeLine(i)} className="text-slate-500 hover:text-red-400">×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Balance indicator */}
            <div className={`mt-2 flex items-center gap-2 text-xs ${balanced && totalDebit > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {balanced && totalDebit > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              Débito: ₡{fmt(totalDebit)} / Crédito: ₡{fmt(totalCredit)}
              {balanced && totalDebit > 0 ? " — Balanceado" : " — Desbalanceado"}
            </div>
          </div>

          {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {saving ? "Guardando..." : "Crear Asiento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel: Plan de Cuentas ────────────────────────────────────────────────────
function ChartOfAccountsPanel() {
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [editAccount, setEditAccount] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (typeFilter) params.set("type", typeFilter);
      const { data } = await api.get(`/accounting/accounts?${params}`);
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [q, typeFilter]);

  React.useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (acc) => {
    await api.put(`/accounting/accounts/${acc.id}`, { isActive: !acc.isActive });
    load();
  };

  const handleDelete = async (acc) => {
    if (!window.confirm(`¿Eliminar la cuenta ${acc.code} — ${acc.name}?`)) return;
    try {
      await api.delete(`/accounting/accounts/${acc.id}`);
      load();
    } catch (e) {
      alert(e?.response?.data?.message ?? "Error al eliminar");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-amber-400" /> Plan de Cuentas
        </h2>
        <button
          onClick={() => { setEditAccount(null); setEditOpen(true); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva Cuenta
        </button>
      </div>

      <div className="flex gap-2">
        <input
          placeholder="Buscar por código o nombre..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 flex-1 max-w-xs"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">Todos los tipos</option>
          <option value="ASSET">Activo</option>
          <option value="LIABILITY">Pasivo</option>
          <option value="EQUITY">Patrimonio</option>
          <option value="INCOME">Ingreso</option>
          <option value="COST">Costo</option>
          <option value="EXPENSE">Gasto</option>
        </select>
        <button onClick={load} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Código</th>
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="text-center px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-500">Cargando...</td></tr>
            )}
            {!loading && accounts.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-500">No hay cuentas</td></tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-amber-300">{a.code}</td>
                <td className="px-4 py-2.5 text-white">
                  {a.description && <div className="text-xs text-slate-500 leading-none mb-0.5">{a.description}</div>}
                  {a.name}
                </td>
                <td className={`px-4 py-2.5 text-xs font-medium ${ACCOUNT_TYPE_COLORS[a.type] ?? "text-slate-400"}`}>{a.type}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${a.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-400"}`}>
                    {a.isActive ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => { setEditAccount(a); setEditOpen(true); }}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-xs"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(a)}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-yellow-400 transition-colors text-xs"
                    >
                      {a.isActive ? "Desactivar" : "Activar"}
                    </button>
                    {!a.isSystem && (
                      <button
                        onClick={() => handleDelete(a)}
                        className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors text-xs"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editOpen && (
        <AccountFormModal
          account={editAccount}
          accounts={accounts}
          onClose={() => { setEditOpen(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Account Form Modal ────────────────────────────────────────────────────────
function AccountFormModal({ account, accounts, onClose }) {
  const isEdit = !!account;
  const [form, setForm] = React.useState({
    code: account?.code ?? "",
    name: account?.name ?? "",
    type: account?.type ?? "ASSET",
    parentId: account?.parentId ?? "",
    description: account?.description ?? "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSave = async () => {
    setError("");
    if (!form.code || !form.name) return setError("Código y nombre son requeridos");
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/accounting/accounts/${account.id}`, {
          name: form.name,
          description: form.description || null,
          parentId: form.parentId || null,
        });
      } else {
        await api.post("/accounting/accounts", {
          code: form.code,
          name: form.name,
          type: form.type,
          description: form.description || null,
          parentId: form.parentId || null,
        });
      }
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="text-white font-semibold">{isEdit ? "Editar Cuenta" : "Nueva Cuenta"}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {!isEdit && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Código *</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="1.1.01"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          {!isEdit && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Tipo *</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ASSET">Activo</option>
                <option value="LIABILITY">Pasivo</option>
                <option value="EQUITY">Patrimonio</option>
                <option value="INCOME">Ingreso</option>
                <option value="COST">Costo</option>
                <option value="EXPENSE">Gasto</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Cuenta padre</label>
            <select
              value={form.parentId}
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">Sin padre (cuenta raíz)</option>
              {accounts.filter((a) => !isEdit || a.id !== account.id).map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Descripción</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel: Mayor de Cuentas ───────────────────────────────────────────────────
function LedgerPanel() {
  const [accounts, setAccounts] = React.useState([]);
  const [accountId, setAccountId] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [ledger, setLedger] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    api.get("/accounting/accounts?active=true")
      .then(({ data }) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const load = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const { data } = await api.get(`/accounting/ledger/${accountId}?${params}`);
      setLedger(data);
    } catch {
      setLedger(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <List className="w-5 h-5 text-amber-400" /> Mayor de Cuentas
      </h2>
      <div className="flex flex-wrap gap-2">
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500 flex-1 min-w-[200px] max-w-xs"
        >
          <option value="">Seleccionar cuenta...</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500" />
        <button
          onClick={load}
          disabled={!accountId}
          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
        >
          Consultar
        </button>
      </div>

      {loading && <div className="text-slate-500 text-sm py-4">Cargando...</div>}

      {ledger && !loading && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">Cuenta</div>
              <div className="font-mono text-xs text-amber-300">{ledger.account.code}</div>
              <div className="text-white font-medium">{ledger.account.name}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">Total Débito</div>
              <div className="text-white font-mono font-semibold">₡{fmt(ledger.totalDebit)}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">Total Crédito</div>
              <div className="text-white font-mono font-semibold">₡{fmt(ledger.totalCredit)}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">Saldo</div>
              <div className={`font-mono font-semibold ${ledger.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ₡{fmt(ledger.balance)}
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Asiento</th>
                  <th className="text-left px-4 py-3">Descripción</th>
                  <th className="text-right px-4 py-3">Débito</th>
                  <th className="text-right px-4 py-3">Crédito</th>
                  <th className="text-right px-4 py-3">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {ledger.rows.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-6 text-slate-500">Sin movimientos</td></tr>
                )}
                {ledger.rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-2 text-slate-300">{new Date(r.entry.date).toLocaleDateString("es-CR")}</td>
                    <td className="px-4 py-2 font-mono text-xs text-amber-300">{r.entry.number}</td>
                    <td className="px-4 py-2 text-slate-300 max-w-xs truncate">{r.entry.description}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-300">{Number(r.debit) > 0 ? `₡${fmt(r.debit)}` : ""}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-300">{Number(r.credit) > 0 ? `₡${fmt(r.credit)}` : ""}</td>
                    <td className={`px-4 py-2 text-right font-mono font-medium ${r.runningBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ₡{fmt(r.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel: Reportes ───────────────────────────────────────────────────────────
function ReportsPanel() {
  const [activeReport, setActiveReport] = React.useState("trial-balance");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [asOf, setAsOf] = React.useState("");
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const REPORTS = [
    { id: "trial-balance", label: "Balance de Comprobación", icon: Scale },
    { id: "income-statement", label: "Estado de Resultados", icon: TrendingUp },
    { id: "balance-sheet", label: "Balance General", icon: FileText },
  ];

  const loadReport = async () => {
    setLoading(true);
    setData(null);
    try {
      const params = new URLSearchParams();
      if (activeReport !== "balance-sheet") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      } else {
        if (asOf) params.set("asOf", asOf);
      }
      const { data: res } = await api.get(`/accounting/reports/${activeReport}?${params}`);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-amber-400" /> Reportes Contables
      </h2>

      {/* Report tabs */}
      <div className="flex gap-2 flex-wrap">
        {REPORTS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveReport(id); setData(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeReport === id
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "bg-white/5 text-slate-400 hover:text-white border border-white/10 hover:border-white/20"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-end flex-wrap">
        {activeReport !== "balance-sheet" ? (
          <>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Desde</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500" />
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Al corte de</label>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500" />
          </div>
        )}
        <button
          onClick={loadReport}
          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg transition-colors"
        >
          {loading ? "Generando..." : "Generar Reporte"}
        </button>
      </div>

      {/* Report output */}
      {data && activeReport === "trial-balance" && <TrialBalanceReport data={data} />}
      {data && activeReport === "income-statement" && <IncomeStatementReport data={data} />}
      {data && activeReport === "balance-sheet" && <BalanceSheetReport data={data} />}
    </div>
  );
}

function TrialBalanceReport({ data }) {
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 text-sm font-medium ${data.balanced ? "text-emerald-400" : "text-red-400"}`}>
        {data.balanced ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        {data.balanced ? "Asiento balanceado" : "Asiento desbalanceado"}
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Código</th>
              <th className="text-left px-4 py-3">Cuenta</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-right px-4 py-3">Débito</th>
              <th className="text-right px-4 py-3">Crédito</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/3">
                <td className="px-4 py-2 font-mono text-xs text-amber-300">{r.code}</td>
                <td className="px-4 py-2 text-white">{r.name}</td>
                <td className={`px-4 py-2 text-xs font-medium ${ACCOUNT_TYPE_COLORS[r.type] ?? "text-slate-400"}`}>{r.type}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-300">{r.debit > 0 ? `₡${fmt(r.debit)}` : ""}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-300">{r.credit > 0 ? `₡${fmt(r.credit)}` : ""}</td>
              </tr>
            ))}
            <tr className="border-t border-white/20 font-bold text-white">
              <td colSpan={3} className="px-4 py-3 text-slate-400 text-xs">TOTALES</td>
              <td className="px-4 py-3 text-right font-mono">₡{fmt(data.totalDebit)}</td>
              <td className="px-4 py-3 text-right font-mono">₡{fmt(data.totalCredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncomeStatementReport({ data }) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
        <div className="text-xs text-slate-500 uppercase tracking-wide">Ingresos Totales</div>
        <div className="text-2xl font-bold text-emerald-400">₡{fmt(data.totalIncome)}</div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
        <div className="text-xs text-slate-500 uppercase tracking-wide">Costos + Gastos</div>
        <div className="text-2xl font-bold text-red-400">₡{fmt(data.totalCost + data.totalExpense)}</div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
        <div className="text-xs text-slate-500 uppercase tracking-wide">Utilidad Neta</div>
        <div className={`text-2xl font-bold ${data.netProfit >= 0 ? "text-amber-400" : "text-red-400"}`}>₡{fmt(data.netProfit)}</div>
      </div>

      <div className="md:col-span-3 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Código</th>
              <th className="text-left px-4 py-3">Cuenta</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-right px-4 py-3">Neto</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/3">
                <td className="px-4 py-2 font-mono text-xs text-amber-300">{r.code}</td>
                <td className="px-4 py-2 text-white">{r.name}</td>
                <td className={`px-4 py-2 text-xs font-medium ${ACCOUNT_TYPE_COLORS[r.type] ?? "text-slate-400"}`}>{r.type}</td>
                <td className={`px-4 py-2 text-right font-mono font-medium ${r.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>₡{fmt(r.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BalanceSheetReport({ data }) {
  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 text-sm font-medium ${data.balanced ? "text-emerald-400" : "text-red-400"}`}>
        {data.balanced ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        Activos {data.balanced ? "=" : "≠"} Pasivos + Patrimonio
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4">
          <div className="text-xs text-sky-400 uppercase tracking-wide mb-1">Total Activos</div>
          <div className="text-2xl font-bold text-sky-300">₡{fmt(data.totalAssets)}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
          <div className="text-xs text-orange-400 uppercase tracking-wide mb-1">Total Pasivos</div>
          <div className="text-2xl font-bold text-orange-300">₡{fmt(data.totalLiabilities)}</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
          <div className="text-xs text-amber-400 uppercase tracking-wide mb-1">Total Patrimonio</div>
          <div className="text-2xl font-bold text-amber-300">₡{fmt(data.totalEquity)}</div>
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Código</th>
              <th className="text-left px-4 py-3">Cuenta</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-right px-4 py-3">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/3">
                <td className="px-4 py-2 font-mono text-xs text-amber-300">{r.code}</td>
                <td className="px-4 py-2 text-white">{r.name}</td>
                <td className={`px-4 py-2 text-xs font-medium ${ACCOUNT_TYPE_COLORS[r.type] ?? "text-slate-400"}`}>{r.type}</td>
                <td className={`px-4 py-2 text-right font-mono font-medium ${r.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>₡{fmt(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Panel: Configuración ──────────────────────────────────────────────────────
function SettingsPanel() {
  const [settings, setSettings] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [seedResult, setSeedResult] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    api.get("/accounting/settings")
      .then(({ data }) => setSettings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { data } = await api.put("/accounting/settings", {
        autoPost: settings.autoPost,
        fiscalPeriods: settings.fiscalPeriods,
        country: settings.country,
      });
      setSettings(data);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult("");
    try {
      const { data } = await api.post("/accounting/initialize");
      setSeedResult(data.message ?? "Listo");
    } catch (e) {
      setSeedResult(e?.response?.data?.message ?? "Error");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <div className="text-slate-500 text-sm py-8">Cargando...</div>;
  if (!settings) return <div className="text-slate-500 text-sm py-8">No se pudo cargar la configuración</div>;

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <Settings className="w-5 h-5 text-amber-400" /> Configuración Contable
      </h2>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">Registro automático</div>
            <div className="text-xs text-slate-500 mt-0.5">Los asientos se contabilizan automáticamente sin aprobación manual</div>
          </div>
          <button
            onClick={() => setSettings((s) => ({ ...s, autoPost: !s.autoPost }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${settings.autoPost ? "bg-amber-600" : "bg-white/10"}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.autoPost ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">Períodos contables</div>
            <div className="text-xs text-slate-500 mt-0.5">Habilita la gestión de períodos y cierres contables</div>
          </div>
          <button
            onClick={() => setSettings((s) => ({ ...s, fiscalPeriods: !s.fiscalPeriods }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${settings.fiscalPeriods ? "bg-amber-600" : "bg-white/10"}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.fiscalPeriods ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">País / Norma contable</label>
          <select
            value={settings.country ?? "CR"}
            onChange={(e) => setSettings((s) => ({ ...s, country: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
          >
            <option value="CR">Costa Rica — NIIF PYMES</option>
          </select>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <div>
          <div className="text-sm font-medium text-white">Plan de Cuentas CR — NIIF PYMES</div>
          <div className="text-xs text-slate-500 mt-0.5">Inicializa el catálogo de cuentas estándar para Costa Rica. Solo agrega cuentas faltantes.</div>
        </div>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {seeding ? "Inicializando..." : "Inicializar plan de cuentas"}
        </button>
        {seedResult && (
          <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{seedResult}</div>
        )}
      </div>
    </div>
  );
}
