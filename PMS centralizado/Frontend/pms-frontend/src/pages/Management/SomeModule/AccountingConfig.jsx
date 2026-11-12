import React from "react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { BookOpen, CheckCircle2, CreditCard, Database, Landmark, Lock, Plug, Scale, Wallet } from "lucide-react";
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

/** Secciones de la pantalla: una a la vez, para no convertirla en una tira larga. */
const CONFIG_TABS = [
  { id: "general", label: "General", icon: BookOpen },
  { id: "conexiones", label: "Conexiones", icon: Plug },
  { id: "cuentas", label: "Cuentas y cobros", icon: Wallet },
  { id: "banco", label: "Banco y plan", icon: Landmark },
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
  const [settingsError, setSettingsError] = React.useState("");
  // Una sección a la vez: la pantalla deja de ser una tira larga de bloques.
  const [tab, setTab] = React.useState("general");

  const hasAccounting = React.useMemo(() => {
    if (!user) return false;
    // El perfil ADMIN siempre entra al módulo.
    if (String(user.role || user.roleId || "").toUpperCase() === "ADMIN") return true;
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
      .catch((e) => {
        // Se muestra el estado HTTP y el motivo: sin eso el fallo parecía del módulo.
        const status = e?.response?.status;
        const serverMsg = e?.response?.data?.message;
        setSettingsError(
          `${status ? `HTTP ${status}` : "Sin respuesta del servidor"}${serverMsg ? ` · ${serverMsg}` : ""}`
        );
        // Aunque falle la lectura, la pantalla sigue usable con los valores por defecto.
        setSettings((prev) => prev ?? { country: "CR", autoPost: false, fiscalPeriods: false, integrations: {} });
      })
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
      <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 text-sm">
        <Lock className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
        <div>
          <div className="font-medium text-white mb-0.5">Módulo Contable no activado</div>
          <div className="text-xs text-slate-400">Este perfil no tiene acceso al módulo de contabilidad.</div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="text-slate-400 text-sm py-4">Cargando...</div>;

  if (!settings) {
    return (
      <div className="mx-auto w-full max-w-5xl rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3">
        <div className="text-sm font-medium text-red-300">{settingsError || "No se pudo cargar la configuración contable."}</div>
        <p className="text-xs text-red-300/80 mt-1">
          Si el mensaje dice «Permiso insuficiente», tu perfil no tiene el módulo Contabilidad: entrá con un perfil
          que sí lo tenga (por ejemplo el perfil admin).
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      {settingsError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
          {settingsError}
          <span className="block text-xs text-red-300/80 mt-0.5">
            Se muestran los valores por defecto; al guardar se reintenta contra el servidor.
          </span>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Secciones de la configuración contable"
        className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1"
      >
        {CONFIG_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* General: cómo se contabiliza y bajo qué normativa */}
      <Section active={tab === "general"} className="grid gap-4 lg:grid-cols-2">
        <Panel icon={BookOpen} title="Registro de asientos" description="Cuándo se contabiliza lo que entra de los módulos.">
          <ToggleRow
            label="Registro automático (Auto-Post)"
            description="Los asientos se contabilizan de inmediato, sin aprobación manual."
            value={settings.autoPost}
            onChange={() => toggle("autoPost")}
          />
          <ToggleRow
            label="Períodos contables"
            description="Habilita períodos y cierres mensuales/anuales."
            value={settings.fiscalPeriods}
            onChange={() => toggle("fiscalPeriods")}
          />
        </Panel>

        <Panel icon={Scale} title="Normativa contable" description="Marco con el que se presentan los estados financieros.">
          <CustomSelect
            value={settings.country ?? "CR"}
            onChange={(e) => setSettings((s) => s ? { ...s, country: e.target.value } : s)}
            className="h-9 w-full max-w-xs"
          >
            <option value="CR">Costa Rica - NIIF PYMES</option>
          </CustomSelect>
          <p className="text-xs text-slate-400">La moneda base se define en Restaurante → Pagos y divisas.</p>
        </Panel>

        <div className="lg:col-span-2">
          <SaveBar
            note="Auto-Post, períodos y normativa se guardan juntos."
            onSave={handleSave}
            saving={saving}
            saved={saveOk}
          />
        </div>
      </Section>

      {/* Conexiones: qué módulos generan asiento */}
      <Section active={tab === "conexiones"} className="space-y-4">
        <Panel
          icon={Plug}
          title="Conexiones con módulos"
          description="El módulo conectado asienta solo cuando ocurre la transacción."
        >
          {INTEGRATION_OPTIONS.map((opt) => (
            <ToggleRow
              key={opt.id}
              label={opt.label}
              description={opt.description}
              value={settings.integrations?.[opt.id] ?? false}
              onChange={() => toggleIntegration(opt.id)}
            />
          ))}
        </Panel>
        <SaveBar
          note="Las conexiones se guardan con la configuración general."
          onSave={handleSave}
          saving={saving}
          saved={saveOk}
        />
      </Section>

      {/* Cuentas: concepto contable y forma de cobro, cada bloque con su guardado */}
      <Section active={tab === "cuentas"} className="space-y-4">
        <Panel
          icon={Wallet}
          title="Cuentas por concepto"
          description="Cuenta del plan que recibe cada movimiento automático de los módulos."
        >
          {accounts.length === 0 ? (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              No hay cuentas activas: inicializá el plan de cuentas para poder ligarlas.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {["Formas de cobro", "Ingresos y contrapartidas"].map((group) => (
                <div key={group} className="rounded-lg border border-white/10 p-3 space-y-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                    {group}
                  </div>
                  {ACCOUNT_CONCEPTS.filter((c) => c.group === group).map((concept) => (
                    <label key={concept.key} className="block">
                      <span className="mb-1 block text-xs text-slate-400">{concept.label}</span>
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
              ))}
            </div>
          )}
          <SaveBar
            note="Cada concepto apunta a una cuenta del plan."
            onSave={handleSave}
            saving={saving}
            saved={saveOk}
          />
        </Panel>

        <Panel
          icon={CreditCard}
          title="Formas de cobro del restaurante"
          description="Cada cobro del punto de venta entra a la cuenta acá asignada."
        >
          {methods.length === 0 ? (
            <p className="text-xs text-slate-400">
              El restaurante todavía no tiene formas de cobro: se definen en Restaurante → Pagos y divisas.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/10 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Forma de cobro</th>
                      <th className="text-left px-3 py-2 font-semibold w-[45%]">Cuenta contable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methods.map((method, idx) => (
                      <tr key={method.id || method.name} className="border-t border-white/10">
                        <td className="px-3 py-2 align-middle">
                          <span className="text-sm font-medium text-white">{method.name}</span>
                          {method.enabled === false && (
                            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                              inactivo
                            </span>
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
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={saveMethodAccounts} disabled={methodsSaving} className={BTN_PRIMARY}>
                  {methodsSaving ? "Guardando..." : "Guardar cuentas de cobro"}
                </button>
                {methodsMsg && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {methodsMsg}
                  </span>
                )}
              </div>
            </>
          )}
        </Panel>
      </Section>

      {/* Banco y plan: credenciales del BCCR y plan de cuentas */}
      <Section active={tab === "banco"} className="grid gap-4 lg:grid-cols-2">
        <Panel
          icon={Landmark}
          title="Tipo de cambio del Banco Central"
          description="Credenciales del BCCR. Se activa en Restaurante → Pagos y divisas."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Correo registrado en el BCCR</span>
              <Input
                value={bccr.email}
                placeholder="correo@ejemplo.com"
                onChange={(e) => setBccr((b) => ({ ...b, email: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Token del BCCR</span>
              <Input
                type="password"
                value={bccr.token}
                placeholder={bccr.tokenSet ? "ya guardado" : "token de indicadores"}
                onChange={(e) => setBccr((b) => ({ ...b, token: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={syncBccr} disabled={bccrBusy} className={BTN_PRIMARY}>
              {bccrBusy ? "Consultando..." : "Actualizar desde el BCCR"}
            </button>
            {bccrMsg && <span className="text-xs text-slate-400">{bccrMsg}</span>}
          </div>
          {bccr.lastSync && !bccrMsg && (
            <p className="text-[11px] text-slate-400">Última actualización: {formatStamp(bccr.lastSync)}</p>
          )}
        </Panel>

        <Panel
          icon={Database}
          title="Plan de cuentas"
          description="Plan estándar de Costa Rica (NIIF PYMES)."
        >
          <p className="text-xs text-slate-400">
            Solo agrega las cuentas faltantes: no sobreescribe las que ya existen.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleSeed} disabled={seeding} className={BTN_PRIMARY}>
              {seeding ? "Inicializando..." : "Inicializar plan de cuentas CR"}
            </button>
            {seedMsg && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {seedMsg}
              </span>
            )}
          </div>
        </Panel>
      </Section>
    </div>
  );
}

/** Contenedor de una sección: sólo se monta la sección activa. */
function Section({ active, className = "", children }) {
  if (!active) return null;
  return <div className={className}>{children}</div>;
}

/** Barra de guardado de una sección: el botón vive en la sección que guarda. */
function SaveBar({ note, onSave, saving, saved, label = "Guardar configuración" }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs text-slate-400">{note}</p>
      <div className="flex items-center gap-3">
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Guardado
          </span>
        )}
        <button onClick={onSave} disabled={saving} className={BTN_PRIMARY}>
          {saving ? "Guardando..." : label}
        </button>
      </div>
    </div>
  );
}

const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors";

/** Bloque de configuración: encabezado con icono y título, y el contenido debajo. */
function Panel({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <header className="flex items-start gap-2.5 pb-3 mb-3 border-b border-white/10">
        <span className="mt-0.5 grid place-items-center w-7 h-7 shrink-0 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-tight text-white">{title}</h4>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
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
  const on = Boolean(value);
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-tight text-white">{label}</div>
        {description && <div className="mt-0.5 text-xs leading-snug text-slate-400">{description}</div>}
      </div>
      {/* Medidas fijas: el riel y la bolita no dependen de utilidades que puedan faltar. */}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onChange}
        className={`relative shrink-0 rounded-full border transition-colors ${
          on ? "border-indigo-700 bg-indigo-600" : "border-black/10 bg-slate-300 dark:border-white/20 dark:bg-white/20"
        }`}
        style={{ width: 44, height: 24 }}
      >
        <span
          className="absolute rounded-full bg-white shadow transition-transform"
          style={{ width: 18, height: 18, top: 2, left: 2, transform: `translateX(${on ? 20 : 0}px)` }}
        />
      </button>
    </div>
  );
}
