import React from "react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { CheckCircle2, Lock } from "lucide-react";
import { CustomSelect } from "../../../components/ui/CustomSelect";
import { Input } from "../../../components/ui/input";

/** dd-mm-aaaa hh:mm para la fecha de la última consulta al BCCR. */
function formatStamp(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

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

/** Conceptos contables que la pantalla deja ligar a una cuenta del plan. */
const ACCOUNT_CONCEPTS = [
  { key: "cash", label: "Efectivo / Caja", group: "Formas de cobro" },
  { key: "card", label: "Tarjeta", group: "Formas de cobro" },
  { key: "sinpe", label: "SINPE Móvil", group: "Formas de cobro" },
  { key: "transfer", label: "Transferencia bancaria", group: "Formas de cobro" },
  { key: "receivable", label: "Cuentas por cobrar", group: "Ingresos y contrapartidas" },
  { key: "restaurantSales", label: "Ingreso por ventas de restaurante", group: "Ingresos y contrapartidas" },
  { key: "roomRevenue", label: "Ingreso por hospedaje", group: "Ingresos y contrapartidas" },
  { key: "vat", label: "IVA por pagar", group: "Ingresos y contrapartidas" },
  { key: "advance", label: "Anticipos de clientes", group: "Ingresos y contrapartidas" },
];

export default function AccountingConfig() {
  const { user } = useAuth();
  const [settings, setSettings] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [seedMsg, setSeedMsg] = React.useState("");
  const [saveOk, setSaveOk] = React.useState(false);
  // Credenciales del Banco Central: viven en la configuración de pagos del
  // restaurante, pero se administran desde acá, con la contabilidad.
  const [bccr, setBccr] = React.useState({ email: "", token: "", tokenSet: false, lastSync: null });
  const [bccrBusy, setBccrBusy] = React.useState(false);
  const [bccrMsg, setBccrMsg] = React.useState("");
  // Plan de cuentas para los selectores de cuenta y formas de cobro del restaurante.
  const [accounts, setAccounts] = React.useState([]);
  const [accountMap, setAccountMap] = React.useState({});
  const [methods, setMethods] = React.useState([]);
  const [methodsSaving, setMethodsSaving] = React.useState(false);
  const [methodsMsg, setMethodsMsg] = React.useState("");

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
      .then(({ data }) => {
        setSettings(data);
        setAccountMap(data?.accountMap && typeof data.accountMap === "object" ? data.accountMap : {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    api.get("/accounting/accounts?active=true")
      .then(({ data }) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setAccounts([]));
  }, [hasAccounting]);

  const toggle = (key) => setSettings((s) => s ? { ...s, [key]: !s[key] } : s);

  React.useEffect(() => {
    if (!hasAccounting) return;
    api.get("/restaurant/payments")
      .then(({ data }) => {
        setBccr({
          email: String(data?.bccrEmail || ""),
          token: "",
          tokenSet: Boolean(data?.bccrTokenSet),
          lastSync: data?.bccrLastSync ?? null,
        });
        setMethods(Array.isArray(data?.paymentMethods) ? data.paymentMethods : []);
      })
      .catch(() => {});
  }, [hasAccounting]);

  /** Liga cada forma de cobro del restaurante con su cuenta contable. */
  const saveMethodAccounts = async () => {
    setMethodsSaving(true);
    setMethodsMsg("");
    try {
      const { data } = await api.put("/restaurant/payments", { paymentMethods: methods });
      setMethods(Array.isArray(data?.paymentMethods) ? data.paymentMethods : methods);
      setMethodsMsg("Cuentas de cobro guardadas");
      setTimeout(() => setMethodsMsg(""), 3000);
    } catch (e) {
      setMethodsMsg(e?.response?.data?.message || "No se pudieron guardar las cuentas de cobro");
    } finally {
      setMethodsSaving(false);
    }
  };

  /** Consulta el tipo de cambio al BCCR y lo deja guardado como compra y venta. */
  const syncBccr = async () => {
    setBccrBusy(true);
    setBccrMsg("");
    try {
      const { data } = await api.post("/restaurant/payments/bccr-sync", {
        bccrEmail: bccr.email.trim(),
        bccrToken: bccr.token.trim(),
      });
      setBccr((b) => ({
        ...b,
        token: "",
        tokenSet: Boolean(data?.bccrTokenSet),
        lastSync: data?.bccrLastSync ?? b.lastSync,
      }));
      setBccrMsg(
        `Compra ${data?.rate?.buy ?? "—"} · venta ${data?.rate?.sell ?? "—"}${data?.rate?.date ? ` (${data.rate.date})` : ""}`
      );
    } catch (e) {
      setBccrMsg(e?.response?.data?.message || "No se pudo consultar el Banco Central.");
    } finally {
      setBccrBusy(false);
    }
  };

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
        accountMap,
      });
      setSettings(data);
      setAccountMap(data?.accountMap && typeof data.accountMap === "object" ? data.accountMap : accountMap);
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

      <section className="space-y-3 border-t border-white/10 pt-4">
        <h4 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Cuentas por concepto</h4>
        <p className="text-xs text-slate-500">
          Cuenta del plan que recibe cada movimiento automático de los módulos.
        </p>
        {accounts.length === 0 ? (
          <p className="text-xs text-amber-400">
            No hay cuentas activas: inicializá el plan de cuentas para poder ligarlas.
          </p>
        ) : (
          ["Formas de cobro", "Ingresos y contrapartidas"].map((group) => (
            <div key={group} className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{group}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {ACCOUNT_CONCEPTS.filter((c) => c.group === group).map((concept) => (
                  <label key={concept.key} className="text-sm">
                    <div className="mb-1 text-xs text-slate-400">{concept.label}</div>
                    <AccountSelect
                      accounts={accounts}
                      value={accountMap?.[concept.key] ?? ""}
                      onChange={(val) =>
                        setAccountMap((m) => ({ ...m, [concept.key]: val }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
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
        <p className="text-xs text-slate-600">La moneda base se define en Restaurante → Pagos y divisas.</p>
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

      <section className="border-t border-white/10 pt-4 space-y-3">
        <h4 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
          Formas de cobro del restaurante
        </h4>
        <p className="text-xs text-slate-500">
          Cada cobro del punto de venta entra a la cuenta acá asignada.
        </p>
        {methods.length === 0 ? (
          <p className="text-xs text-slate-500">
            El restaurante todavía no tiene formas de cobro: se definen en Restaurante → Pagos y divisas.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Forma de cobro</th>
                    <th className="text-left px-3 py-2 font-medium w-[45%]">Cuenta contable</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map((method, idx) => (
                    <tr key={method.id || method.name} className="border-t border-white/5">
                      <td className="px-3 py-2 text-white">
                        {method.name}
                        {method.enabled === false && (
                          <span className="ml-2 text-[11px] text-slate-500">inactivo</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <AccountSelect
                          accounts={accounts}
                          value={method.account ?? ""}
                          placeholder="— usa la cuenta de efectivo —"
                          onChange={(val) =>
                            setMethods((list) =>
                              list.map((m, i) => (i === idx ? { ...m, account: val } : m))
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveMethodAccounts}
                disabled={methodsSaving}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {methodsSaving ? "Guardando..." : "Guardar cuentas de cobro"}
              </button>
              {methodsMsg && <span className="text-xs text-slate-400">{methodsMsg}</span>}
            </div>
          </>
        )}
      </section>

      <section className="border-t border-white/10 pt-4 space-y-3">
        <h4 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Tipo de cambio del Banco Central</h4>
        <p className="text-xs text-slate-500">
          Credenciales del servicio de indicadores económicos (BCCR). Se activa en Restaurante → Pagos y divisas.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 max-w-[520px]">
          <label className="text-sm">
            <div className="mb-1 text-xs text-slate-400">Correo registrado en el BCCR</div>
            <Input
              value={bccr.email}
              placeholder="correo@ejemplo.com"
              onChange={(e) => setBccr((b) => ({ ...b, email: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs text-slate-400">Token del BCCR</div>
            <Input
              type="password"
              value={bccr.token}
              placeholder={bccr.tokenSet ? "ya guardado" : "token de indicadores"}
              onChange={(e) => setBccr((b) => ({ ...b, token: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={syncBccr}
            disabled={bccrBusy}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {bccrBusy ? "Consultando..." : "Actualizar desde el BCCR"}
          </button>
          {bccrMsg && <span className="text-xs text-slate-400">{bccrMsg}</span>}
        </div>
        {bccr.lastSync && !bccrMsg && (
          <p className="text-[11px] text-slate-500">Última actualización: {formatStamp(bccr.lastSync)}</p>
        )}
      </section>

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

function AccountSelect({ value, onChange, accounts, placeholder }) {
  return (
    <CustomSelect
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full max-w-sm"
    >
      <option value="">{placeholder ?? "— cuenta estándar —"}</option>
      {(accounts ?? []).map((acc) => (
        <option key={acc.id} value={acc.id}>
          {acc.code} · {acc.name}
        </option>
      ))}
    </CustomSelect>
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
