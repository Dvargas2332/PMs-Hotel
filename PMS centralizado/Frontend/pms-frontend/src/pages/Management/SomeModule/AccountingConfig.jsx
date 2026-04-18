import React from "react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { CheckCircle2, Lock } from "lucide-react";
import { CustomSelect } from "../../../components/ui/CustomSelect";

const INTEGRATION_OPTIONS = [
  {
    id: "einvoicing",
    label: "Facturación Electrónica",
    description: "Genera asientos automáticos al emitir o anular documentos electrónicos.",
    membership: "accounting",
  },
  {
    id: "restaurant",
    label: "Restaurante",
    description: "Registra ingresos y costos por ventas del restaurante.",
    membership: "accounting",
  },
  {
    id: "frontdesk",
    label: "Recepción (FrontDesk)",
    description: "Contabiliza cargos por hospedaje, check-in/check-out y pagos.",
    membership: "accounting",
  },
];

export default function AccountingConfig() {
  const { user } = useAuth();
  const [settings, setSettings] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [seedMsg, setSeedMsg] = React.useState("");
  const [saveOk, setSaveOk] = React.useState(false);

  const hasAccounting = React.useMemo(() => {
    if (!user) return false;
    const allowedByList = Array.isArray(user.allowedModules) && user.allowedModules.includes("accounting");
    const allowedByPerms =
      Array.isArray(user.permissions) &&
      user.permissions.some((p) => typeof p === "string" && p.startsWith("accounting."));
    return allowedByList || allowedByPerms;
  }, [user]);

  React.useEffect(() => {
    if (!hasAccounting) return;
    setLoading(true);
    api.get("/accounting/settings")
      .then(({ data }) => setSettings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hasAccounting]);

  const toggle = (key) => setSettings((s) => s ? { ...s, [key]: !s[key] } : s);

  const toggleIntegration = (id) =>
    setSettings((s) => {
      if (!s) return s;
      const integrations = { ...(s.integrations ?? {}), [id]: !s.integrations?.[id] };
      return { ...s, integrations };
    });

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveOk(false);
    try {
      const { data } = await api.put("/accounting/settings", {
        autoPost: settings.autoPost,
        fiscalPeriods: settings.fiscalPeriods,
        country: settings.country,
        integrations: settings.integrations ?? {},
      });
      setSettings(data);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const { data } = await api.post("/accounting/initialize");
      setSeedMsg(data.message ?? "Listo");
    } catch (e) {
      setSeedMsg(e?.response?.data?.message ?? "Error al inicializar");
    } finally {
      setSeeding(false);
    }
  };

  if (!hasAccounting) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/3 text-slate-500 text-sm">
        <Lock className="w-4 h-4 mt-0.5 shrink-0 text-slate-600" />
        <div>
          <div className="font-medium text-slate-400 mb-0.5">Módulo Contable no activado</div>
          <div className="text-xs">Este perfil no tiene acceso al módulo de contabilidad.</div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="text-slate-500 text-sm py-4">Cargando...</div>;

  if (!settings) return <div className="text-slate-500 text-sm py-4">No se pudo cargar la configuración contable.</div>;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h4 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Registro de asientos</h4>
        <ToggleRow
          label="Registro automático (Auto-Post)"
          description="Los asientos se contabilizan inmediatamente sin aprobación manual."
          value={settings.autoPost}
          onChange={() => toggle("autoPost")}
        />
        <ToggleRow
          label="Períodos contables"
          description="Habilita gestión de períodos y cierres mensuales/anuales."
          value={settings.fiscalPeriods}
          onChange={() => toggle("fiscalPeriods")}
        />
      </section>

      <section className="space-y-3">
        <h4 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Conexiones con módulos</h4>
        <p className="text-xs text-slate-500">
          Al activar una conexión, el módulo generará asientos contables automáticamente cuando ocurran transacciones.
        </p>
        {INTEGRATION_OPTIONS.map((opt) => (
          <ToggleRow
            key={opt.id}
            label={opt.label}
            description={opt.description}
            value={settings.integrations?.[opt.id] ?? false}
            onChange={() => toggleIntegration(opt.id)}
          />
        ))}
      </section>

      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Normativa contable</h4>
        <CustomSelect
          value={settings.country ?? "CR"}
          onChange={(e) => setSettings((s) => s ? { ...s, country: e.target.value } : s)}
          className="h-9 w-full max-w-xs"
        >
          <option value="CR">Costa Rica - NIIF PYMES</option>
        </CustomSelect>
        <p className="text-xs text-slate-600">La moneda se hereda de la configuración general del sistema.</p>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {saving ? "Guardando..." : "Guardar configuración"}
        </button>
        {saveOk && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
          </span>
        )}
      </div>

      <section className="border-t border-white/10 pt-4 space-y-2">
        <h4 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Plan de Cuentas</h4>
        <p className="text-xs text-slate-500">
          Inicializa el plan de cuentas estándar para Costa Rica (NIIF PYMES). Solo agrega cuentas faltantes, no sobreescribe las existentes.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {seeding ? "Inicializando..." : "Inicializar plan de cuentas CR"}
          </button>
          {seedMsg && <span className="text-xs text-emerald-400">{seedMsg}</span>}
        </div>
      </section>
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white leading-tight">{label}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
      </div>
      <button
        onClick={onChange}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors mt-0.5 ${value ? "bg-violet-600" : "bg-white/10"}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
