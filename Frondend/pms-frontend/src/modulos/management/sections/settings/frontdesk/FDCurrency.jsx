import { useEffect, useMemo, useState } from "react";
import useConfigStore from "../../../../../store/configStore";

const ISO = ["CRC", "USD", "EUR", "MXN", "GBP", "COP", "ARS", "BRL", "PEN"];

const PROVIDERS = [
  { id: "manual", label: "Manual" },
  { id: "bccr", label: "BCCR (CRC⇄USD)" },
  { id: "ecb", label: "ECB / exchangerate.host" },
  { id: "custom", label: "Custom (tu API)" },
];

export default function FDCurrency() {
  const hasHydrated = useConfigStore((s) => s._hasHydrated);

  // leer desde store (con fallback si todavía no existe fx)
  const fx = useConfigStore((s) => s.config.accounting?.fx ?? {
    provider: "manual",
    base: "CRC",
    display: "CRC",
    supported: ["CRC", "USD", "EUR"],
    rates: {},          // {USD: 0.002, EUR: 0.0018 ...} relativos a base
    rounding: 2,
    lastUpdated: null,
    custom: { endpoint: "", apiKey: "", headers: "" },
    bccr: { // indicadores de referencia (opcional)
      use: "venta",     // 'compra' | 'venta' | 'promedio'
    },
  });

  const setAccounting = useConfigStore((s) => s.setAccounting);

  const [form, setForm] = useState(fx);
  const [probe, setProbe] = useState({ amount: "10000", from: fx.base, to: fx.display });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { setForm(fx); }, [fx?.provider, fx?.base, fx?.display]); // si el store cambia externamente

  const canSave = useMemo(() => {
    if (!form.base || !ISO.includes(form.base)) return false;
    if (!form.display || !ISO.includes(form.display)) return false;
    if (!Array.isArray(form.supported) || !form.supported.length) return false;
    return true;
  }, [form]);

  if (!hasHydrated) return <div className="p-4 text-gray-500">Cargando…</div>;

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const updateRate = (code, value) => {
    const v = value === "" ? "" : Number(value);
    if (v === "" || Number.isFinite(v)) {
      setForm((f) => ({ ...f, rates: { ...f.rates, [code]: value === "" ? "" : v } }));
    }
  };

  const removeRate = (code) => {
    const next = { ...form.rates };
    delete next[code];
    setForm((f) => ({ ...f, rates: next, supported: f.supported.filter((c) => c !== code) }));
  };

  const addSupported = (code) => {
    if (!code || form.supported.includes(code)) return;
    setForm((f) => ({
      ...f,
      supported: [...f.supported, code],
      rates: { ...f.rates },
    }));
  };

  const convert = (amount, from, to) => {
    const a = Number(amount);
    if (!Number.isFinite(a)) return null;
    const base = form.base;
    if (from === to) return round(a, form.rounding);
    if (from === base) {
      const r = form.rates[to];
      if (!Number.isFinite(r)) return null;
      return round(a * r, form.rounding);
    }
    if (to === base) {
      const r = form.rates[from];
      if (!Number.isFinite(r)) return null;
      return round(a / r, form.rounding);
    }
    // from -> base -> to
    const rFrom = form.rates[from];
    const rTo = form.rates[to];
    if (!Number.isFinite(rFrom) || !Number.isFinite(rTo)) return null;
    return round((a / rFrom) * rTo, form.rounding);
  };

  const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

  const handleSave = async () => {
    setBusy(true); setMsg("");
    try {
      // Aquí podrías llamar a tu backend para persistir:
      // await fetch("/api/accounting/fx/settings", { method: "POST", body: JSON.stringify(form) })
      setAccounting({ fx: { ...form, lastUpdated: new Date().toISOString() } });
      setMsg("Guardado localmente. (Conecta tu backend para persistir en servidor).");
    } catch (e) {
      console.error(e);
      setMsg("Error guardando.");
    } finally {
      setBusy(false);
    }
  };

  const fetchRates = async () => {
    setBusy(true); setMsg("");
    try {
      let nextRates = {};

      if (form.provider === "ecb") {
        // Gratis: exchangerate.host (proxy de ECB). Base = form.base
        const res = await fetch(`https://api.exchangerate.host/latest?base=${encodeURIComponent(form.base)}`);
        const data = await res.json();
        // Filtramos sólo las soportadas
        for (const c of form.supported) {
          if (c === form.base) continue;
          if (data?.rates?.[c]) nextRates[c] = Number(data.rates[c]);
        }
      } else if (form.provider === "bccr") {
        // BCCR: usualmente CRC<->USD. Aquí dejamos ejemplo para derivar tasas:
        // NOTA: normalmente necesitarás un backend/proxy para SOAP o CORS.
        // Simulación simple: pedimos USD base y derivamos los demás si existen en rates actuales.
        // Reemplaza esto por tu llamada real al BCCR y calcula nextRates respecto a 'form.base'.
        throw new Error("Para BCCR, configura un endpoint en tu backend (SOAP/JSON) y úsalo aquí.");
      } else if (form.provider === "custom") {
        if (!form.custom?.endpoint) throw new Error("Configura endpoint custom.");
        const res = await fetch(form.custom.endpoint, {
          headers: parseHeaders(form.custom?.headers),
        });
        const data = await res.json();
        // Se espera un shape { base: "CRC", rates: { USD: 0.0019, EUR: ... } }
        const base = data.base || form.base;
        const rates = data.rates || {};
        // Si el base que viene no es el mismo, re-referenciamos a form.base
        if (base === form.base) {
          nextRates = pickRates(rates, form.supported, form.base);
        } else {
          // convertir rates a la nueva base
          // suponemos que 'rates[form.base]' existe
          const toBase = rates[form.base];
          if (!toBase) throw new Error("El endpoint debe incluir tasa hacia la moneda base seleccionada.");
          for (const c of form.supported) {
            if (c === form.base) continue;
            if (rates[c]) nextRates[c] = Number(rates[c]) / Number(toBase);
          }
        }
      } else {
        // Manual: no hay fetch
        setMsg("Proveedor manual: ajusta las tasas arriba.");
        setBusy(false);
        return;
      }

      setForm((f) => ({ ...f, rates: nextRates, lastUpdated: new Date().toISOString() }));
      setMsg("Tasas actualizadas.");
    } catch (e) {
      console.error(e);
      setMsg(e.message || "Error al actualizar tasas.");
    } finally {
      setBusy(false);
    }
  };

  const rateRow = (code) => (
    <tr key={code} className="border-b">
      <td className="py-1">{code}</td>
      <td className="py-1">
        {code === form.base ? (
          <span className="text-gray-500">1.000000</span>
        ) : (
          <input
            className="border rounded p-1 w-36"
            placeholder="0.0020"
            value={form.rates?.[code] ?? ""}
            onChange={(e) => updateRate(code, e.target.value)}
            disabled={form.provider !== "manual"}
          />
        )}
      </td>
      <td className="py-1 text-right">
        {code !== form.base && (
          <button className="px-2 py-1 rounded bg-red-600 text-white"
                  onClick={() => removeRate(code)}>
            Quitar
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Currency</h3>

      {/* proveedor */}
      <section className="space-y-2">
        <div className="font-medium">Proveedor</div>
        <div className="flex flex-wrap gap-3">
          {PROVIDERS.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="provider"
                checked={form.provider === p.id}
                onChange={() => update({ provider: p.id })}
              />
              <span>{p.label}</span>
            </label>
          ))}
        </div>

        {form.provider === "bccr" && (
          <div className="text-sm text-gray-600">
            BCCR suele proveer **CRC⇄USD**. Recomendado: consumir desde tu backend (SOAP/JSON) y derivar al resto.
          </div>
        )}

        {form.provider === "custom" && (
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-gray-600">Endpoint (GET)</span>
              <input
                className="border p-2 rounded w-full"
                placeholder="https://tu-api/fx/latest?base=CRC"
                value={form.custom?.endpoint ?? ""}
                onChange={(e) =>
                  update({ custom: { ...form.custom, endpoint: e.target.value } })
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-600">Headers (JSON)</span>
              <input
                className="border p-2 rounded w-full"
                placeholder='{"Authorization":"Bearer xyz"}'
                value={form.custom?.headers ?? ""}
                onChange={(e) =>
                  update({ custom: { ...form.custom, headers: e.target.value } })
                }
              />
            </label>
          </div>
        )}
      </section>

      {/* base / display / supported */}
      <section className="grid md:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="text-sm text-gray-600">Moneda base</span>
          <select
            className="border p-2 rounded w-full"
            value={form.base}
            onChange={(e) => {
              const next = e.target.value;
              // asegurar que base esté en supported y tenga tasa 1
              const sup = new Set(form.supported);
              sup.add(next);
              update({ base: next, supported: Array.from(sup) });
            }}
          >
            {ISO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm text-gray-600">Moneda de visualización</span>
          <select
            className="border p-2 rounded w-full"
            value={form.display}
            onChange={(e) => update({ display: e.target.value })}
          >
            {ISO.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm text-gray-600">Redondeo (decimales)</span>
          <input
            className="border p-2 rounded w-full"
            type="number" min={0} max={6}
            value={form.rounding}
            onChange={(e) => update({ rounding: Math.max(0, Math.min(6, Number(e.target.value))) })}
          />
        </label>
      </section>

      {/* añadir soportadas */}
      <section className="space-y-2">
        <div className="font-medium">Monedas soportadas</div>
        <div className="flex items-center gap-2">
          <select
            className="border p-2 rounded"
            onChange={(e) => { addSupported(e.target.value); e.target.value = ""; }}
            defaultValue=""
          >
            <option value="" disabled>Agregar moneda…</option>
            {ISO.filter((c) => !form.supported.includes(c)).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            className="px-3 py-2 rounded bg-indigo-700 text-white disabled:opacity-50"
            onClick={fetchRates}
            disabled={busy || form.provider === "manual"}
            title={form.provider === "manual" ? "Proveedor manual: edita las tasas abajo" : "Actualizar desde proveedor"}
          >
            {busy ? "Actualizando…" : "Actualizar tasas"}
          </button>
        </div>

        {/* tabla de tasas */}
        <div className="overflow-x-auto border rounded bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Moneda</th>
                <th className="text-left p-2">Tasa vs {form.base}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {[form.base, ...form.supported.filter((c) => c !== form.base)].map(rateRow)}
            </tbody>
          </table>
        </div>

        {form.lastUpdated && (
          <div className="text-xs text-gray-500">
            Última actualización: {new Date(form.lastUpdated).toLocaleString()}
          </div>
        )}
      </section>

      {/* Probar conversión */}
      <section className="space-y-2">
        <div className="font-medium">Probar conversión</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Monto</span>
            <input
              className="border p-2 rounded w-40"
              value={probe.amount}
              onChange={(e) => setProbe((p) => ({ ...p, amount: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">De</span>
            <select
              className="border p-2 rounded"
              value={probe.from}
              onChange={(e) => setProbe((p) => ({ ...p, from: e.target.value }))}
            >
              {[form.base, ...form.supported.filter((c) => c !== form.base)].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">A</span>
            <select
              className="border p-2 rounded"
              value={probe.to}
              onChange={(e) => setProbe((p) => ({ ...p, to: e.target.value }))}
            >
              {[form.base, ...form.supported.filter((c) => c !== form.base)].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="p-2 font-semibold">
            {(() => {
              const r = convert(probe.amount, probe.from, probe.to);
              return r == null ? "—" : `${r} ${probe.to}`;
            })()}
          </div>
        </div>
      </section>

      {/* Guardar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="px-3 py-2 rounded bg-green-700 text-white disabled:opacity-50"
          disabled={!canSave || busy}
          onClick={handleSave}
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </div>
  );
}

// helpers
function parseHeaders(txt) {
  if (!txt) return {};
  try { return JSON.parse(txt); } catch { return {}; }
}
function pickRates(rates, supported, base) {
  const out = {};
  for (const c of supported) {
    if (c === base) continue;
    if (rates[c]) out[c] = Number(rates[c]);
  }
  return out;
}
