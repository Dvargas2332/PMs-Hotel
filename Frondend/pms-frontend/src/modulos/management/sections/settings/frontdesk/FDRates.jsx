// src/modulos/management/secciones/configuraciones/frontdesk/FDRates.jsx
import { useMemo, useState } from "react";
import useConfigStore from "../../../../../store/configStore";

// Días de la semana (0 = dom para JS)
const DOW = [
  { v: 1, l: "Lun" },
  { v: 2, l: "Mar" },
  { v: 3, l: "Mié" },
  { v: 4, l: "Jue" },
  { v: 5, l: "Vie" },
  { v: 6, l: "Sáb" },
  { v: 0, l: "Dom" },
];

const MODEL_OPTIONS = [
  { id: "per_room", label: "Por habitación (por noche)" },
  { id: "per_person", label: "Por persona (por noche)" },
  { id: "room_plus_person", label: "Mixto (habitación + persona)" },
];

const EXTRA_OPTIONS = [
  { id: "fixed", label: "Fijo" },
  { id: "percent", label: "Porcentaje" },
];

const newRule = (roomTypesGuess) => ({
  name: "",
  scopeMode: "roomType", // "roomType" | "rooms"
  roomTypes: roomTypesGuess.length ? [roomTypesGuess[0]] : [],
  roomIds: [],
  model: "per_room", // "per_room" | "per_person" | "room_plus_person"
  prices: { perRoom: "", perPerson: "" },
  occupancy: { includedGuests: 2, maxOccupancy: 4 },
  extras: {
    kind: "fixed", // "fixed" | "percent"
    value: "",     // número o ""
    fromGuests: 3,
    percentBasis: "perRoom",
  },
  dateRules: [
    {
      start: "",
      end: "",
      dow: [1, 2, 3, 4, 5, 6, 0],
      minNights: 1,
      maxNights: "",
      overridePrice: "",
    },
  ],
  currency: null,
});

export default function FDRates() {
  // ---- TODOS LOS HOOKS VAN ARRIBA (NUNCA DESPUÉS DE UN return) ----
  const hasHydrated = useConfigStore((s) => s._hasHydrated);
  const rooms = useConfigStore((s) => s.config.rooms);
  const displayCurrency = useConfigStore((s) => s.config.accounting?.fx?.display ?? "CRC");

  const roomTypes = useMemo(() => {
    const set = new Set(rooms.map((r) => r.type || "standard"));
    if (set.size === 0) ["standard", "suite", "deluxe"].forEach((t) => set.add(t));
    return Array.from(set);
  }, [rooms]);

  // estados del componente
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState(() => newRule(roomTypes)); // lazy init OK

  // simulador
  const [sim, setSim] = useState({ guests: 2, ruleIndex: -1 });
  const computedSim = useMemo(() => {
    const rule = sim.ruleIndex >= 0 ? queue[sim.ruleIndex] : draft;
    if (!rule) return "—";
    const { model, prices, occupancy, extras } = rule;
    const g = Number(sim.guests);
    if (!Number.isFinite(g) || g <= 0) return "—";

    let base = 0;
    if (model === "per_room") base = Number(prices.perRoom || 0);
    if (model === "per_person") base = g * Number(prices.perPerson || 0);
    if (model === "room_plus_person") base = Number(prices.perRoom || 0) + g * Number(prices.perPerson || 0);

    // extra persons
    const included = Number(occupancy.includedGuests || 0);
    const extraCount = Math.max(0, g - Math.max(included, 0));
    let extra = 0;
    if (extraCount > 0 && extras.value !== "") {
      if (extras.kind === "fixed") {
        extra = extraCount * Number(extras.value || 0);
      } else {
        const perc = Number(extras.value || 0) / 100;
        extra = perc * base;
      }
    }
    const total = base + extra;
    if (!Number.isFinite(total)) return "—";
    return `${total.toFixed(2)} ${displayCurrency}`;
  }, [sim, queue, draft, displayCurrency]);

  // ---- DESPUÉS DE TODOS LOS HOOKS, YA PUEDES USAR returns TEMPRANOS ----
  if (!hasHydrated) {
    return <div className="p-4 text-gray-500">Cargando…</div>;
  }

  // helpers UI
  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setPrice = (key, val) => {
    const v = val === "" ? "" : Number(val);
    if (v === "" || Number.isFinite(v)) {
      setDraft((d) => ({ ...d, prices: { ...d.prices, [key]: val === "" ? "" : v } }));
    }
  };
  const setExtra = (patch) => setDraft((d) => ({ ...d, extras: { ...d.extras, ...patch } }));
  const setOcc = (patch) => setDraft((d) => ({ ...d, occupancy: { ...d.occupancy, ...patch } }));

  const addDateRule = () =>
    setDraft((d) => ({
      ...d,
      dateRules: [
        ...d.dateRules,
        { start: "", end: "", dow: [1, 2, 3, 4, 5, 6, 0], minNights: 1, maxNights: "", overridePrice: "" },
      ],
    }));

  const updateDateRule = (idx, patch) =>
    setDraft((d) => ({
      ...d,
      dateRules: d.dateRules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));

  const toggleDow = (idx, dow) =>
    setDraft((d) => {
      const r = d.dateRules[idx];
      const exists = r.dow.includes(dow);
      const next = exists ? r.dow.filter((x) => x !== dow) : [...r.dow, dow];
      return { ...d, dateRules: d.dateRules.map((x, i) => (i === idx ? { ...x, dow: next } : x)) };
    });

  const removeDateRule = (idx) =>
    setDraft((d) => ({ ...d, dateRules: d.dateRules.filter((_, i) => i !== idx) }));

  // Validaciones
  const validName = draft.name.trim().length > 0;
  const validScope =
    (draft.scopeMode === "roomType" && draft.roomTypes.length > 0) ||
    (draft.scopeMode === "rooms" && draft.roomIds.length > 0);
  const validModel =
    (draft.model === "per_room" && Number(draft.prices.perRoom) > 0) ||
    (draft.model === "per_person" && Number(draft.prices.perPerson) > 0) ||
    (draft.model === "room_plus_person" &&
      Number(draft.prices.perRoom) > 0 &&
      Number(draft.prices.perPerson) > 0);
  const validExtras =
    draft.extras.value === "" ||
    (draft.extras.kind === "fixed" && Number(draft.extras.value) >= 0) ||
    (draft.extras.kind === "percent" && Number(draft.extras.value) >= 0 && Number(draft.extras.value) <= 100);
  const validDates = draft.dateRules.every((r) => r.start && r.end && r.dow.length > 0 && Number(r.minNights) >= 1);
  const canQueue = validName && validScope && validModel && validExtras && validDates;

  // Encolar (no modifica store)
  const addRuleToQueue = () => {
    if (!canQueue) return;
    const payload = {
      ...draft,
      currency: displayCurrency,
      roomIds: draft.scopeMode === "rooms" ? draft.roomIds : [],
    };
    setQueue((q) => [...q, { ...payload, id: "tmp-" + (q.length + 1) }]);
    setDraft(newRule(roomTypes));
    setMsg("");
  };

  const removeFromQueue = (id) => setQueue((q) => q.filter((r) => r.id !== id));

  // Enviar al backend
  const sendToBackend = async () => {
    if (!queue.length) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/rates/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates: queue }),
      });
      if (!res.ok) throw new Error("No se pudo guardar las tarifas.");
      setQueue([]);
      setMsg("Solicitudes enviadas. Se reflejarán cuando el backend sincronice.");
    } catch (e) {
      console.error(e);
      setMsg(e.message || "Error al enviar al backend.");
    } finally {
      setBusy(false);
    }
  };

  // UI
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Rates</h3>

      {/* Básicos */}
      <section className="space-y-3">
        <div className="grid md:grid-cols-3 gap-4">
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Nombre de la tarifa</span>
            <input
              className="border rounded p-2 w-full"
              placeholder="Tarifa Rack, No reembolsable, etc."
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-gray-600">Modelo de precio</span>
            <select
              className="border rounded p-2 w-full"
              value={draft.model}
              onChange={(e) => update({ model: e.target.value })}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>

          <div className="space-y-1">
            <div className="text-sm text-gray-600">Moneda</div>
            <div className="p-2 border rounded bg-gray-50">{displayCurrency}</div>
          </div>
        </div>

        {/* Precios y ocupación */}
        <div className="grid md:grid-cols-3 gap-4">
          {(draft.model === "per_room" || draft.model === "room_plus_person") && (
            <label className="space-y-1">
              <span className="text-sm text-gray-600">Precio por habitación / noche</span>
              <input
                className="border rounded p-2 w-full"
                placeholder="50000"
                value={draft.prices.perRoom}
                onChange={(e) => setPrice("perRoom", e.target.value)}
              />
            </label>
          )}
          {(draft.model === "per_person" || draft.model === "room_plus_person") && (
            <label className="space-y-1">
              <span className="text-sm text-gray-600">Precio por persona / noche</span>
              <input
                className="border rounded p-2 w-full"
                placeholder="25000"
                value={draft.prices.perPerson}
                onChange={(e) => setPrice("perPerson", e.target.value)}
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-sm text-gray-600">Incluye huéspedes</span>
              <input
                className="border rounded p-2 w-full"
                type="number"
                min={0}
                value={draft.occupancy.includedGuests}
                onChange={(e) => setOcc({ includedGuests: Number(e.target.value) })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-600">Ocupación máx.</span>
              <input
                className="border rounded p-2 w-full"
                type="number"
                min={1}
                value={draft.occupancy.maxOccupancy}
                onChange={(e) => setOcc({ maxOccupancy: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>

        {/* Extras */}
        <div className="grid md:grid-cols-3 gap-4">
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Cargo por persona extra</span>
            <select
              className="border rounded p-2 w-full"
              value={draft.extras.kind}
              onChange={(e) => setExtra({ kind: e.target.value })}
            >
              {EXTRA_OPTIONS.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm text-gray-600">
              Valor {draft.extras.kind === "percent" ? "(%)" : `(${displayCurrency})`}
            </span>
            <input
              className="border rounded p-2 w-full"
              placeholder={draft.extras.kind === "percent" ? "10" : "5000"}
              value={draft.extras.value}
              onChange={(e) => setExtra({ value: e.target.value })}
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-gray-600">A partir de (# huéspedes)</span>
            <input
              className="border rounded p-2 w-full"
              type="number"
              min={0}
              value={draft.extras.fromGuests}
              onChange={(e) => setExtra({ fromGuests: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      {/* Ámbito */}
      <section className="space-y-3">
        <div className="font-medium">Aplicar a</div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={draft.scopeMode === "roomType"}
              onChange={() => update({ scopeMode: "roomType" })}
            />
            <span>Tipo de habitación</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={draft.scopeMode === "rooms"}
              onChange={() => update({ scopeMode: "rooms" })}
            />
            <span>Habitaciones específicas</span>
          </label>
        </div>

        {draft.scopeMode === "roomType" ? (
          <div className="flex flex-wrap gap-2">
            {roomTypes.map((t) => {
              const active = draft.roomTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    update({
                      roomTypes: active
                        ? draft.roomTypes.filter((x) => x !== t)
                        : [...draft.roomTypes, t],
                    })
                  }
                  className={`px-3 py-1 rounded border ${active ? "bg-slate-800 text-white" : "bg-white"}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rooms.map((r) => {
              const active = draft.roomIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    update({
                      roomIds: active
                        ? draft.roomIds.filter((x) => x !== r.id)
                        : [...draft.roomIds, r.id],
                    })
                  }
                  className={`px-3 py-1 rounded border ${active ? "bg-slate-800 text-white" : "bg-white"}`}
                  title={`Hab. ${r.number} (${r.type})`}
                >
                  {r.number}
                </button>
              );
            })}
            {rooms.length === 0 && (
              <div className="text-sm text-gray-500">No hay habitaciones registradas todavía.</div>
            )}
          </div>
        )}
      </section>

      {/* Reglas por fecha */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Reglas por fechas</div>
          <button className="px-3 py-1 rounded bg-blue-700 text-white" type="button" onClick={addDateRule}>
            Añadir rango
          </button>
        </div>

        {draft.dateRules.map((r, idx) => (
          <div key={idx} className="border rounded p-3 space-y-2 bg-white">
            <div className="grid md:grid-cols-4 gap-2">
              <label className="space-y-1">
                <span className="text-sm text-gray-600">Desde</span>
                <input
                  type="date"
                  className="border rounded p-2 w-full"
                  value={r.start}
                  onChange={(e) => updateDateRule(idx, { start: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-600">Hasta</span>
                <input
                  type="date"
                  className="border rounded p-2 w-full"
                  value={r.end}
                  onChange={(e) => updateDateRule(idx, { end: e.target.value })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-600">Min. noches</span>
                <input
                  type="number"
                  min={1}
                  className="border rounded p-2 w-full"
                  value={r.minNights}
                  onChange={(e) => updateDateRule(idx, { minNights: Number(e.target.value) })}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-600">Max. noches</span>
                <input
                  type="number"
                  min={1}
                  className="border rounded p-2 w-full"
                  value={r.maxNights}
                  onChange={(e) =>
                    updateDateRule(idx, { maxNights: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {DOW.map((d) => {
                const active = r.dow.includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDow(idx, d.v)}
                    className={`px-3 py-1 rounded border ${active ? "bg-slate-800 text-white" : "bg-white"}`}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>

            <div className="grid md:grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-sm text-gray-600">
                  Override precio por noche ({displayCurrency}) (opcional)
                </span>
                <input
                  className="border rounded p-2 w-full"
                  placeholder="Ej. 65000"
                  value={r.overridePrice}
                  onChange={(e) => {
                    const v = e.target.value === "" ? "" : Number(e.target.value);
                    updateDateRule(
                      idx,
                      { overridePrice: e.target.value === "" || Number.isFinite(v) ? e.target.value : r.overridePrice }
                    );
                  }}
                />
              </label>

              <div className="text-right">
                <button
                  type="button"
                  className="px-3 py-1 rounded bg-red-600 text-white mt-6"
                  onClick={() => removeDateRule(idx)}
                >
                  Eliminar rango
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Simulador */}
      <section className="space-y-2">
        <div className="font-medium">Simular precio (por noche)</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Huéspedes</span>
            <input
              className="border rounded p-2 w-32"
              type="number"
              min={1}
              value={sim.guests}
              onChange={(e) => setSim((s) => ({ ...s, guests: Number(e.target.value) }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-600">Usar regla en cola</span>
            <select
              className="border rounded p-2"
              value={sim.ruleIndex}
              onChange={(e) => setSim((s) => ({ ...s, ruleIndex: Number(e.target.value) }))}
            >
              <option value={-1}>— (borrador actual)</option>
              {queue.map((r, i) => (
                <option key={r.id} value={i}>{r.name}</option>
              ))}
            </select>
          </label>
          <div className="p-2 font-semibold">{computedSim}</div>
        </div>
      </section>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="px-3 py-2 rounded bg-emerald-700 text-white disabled:opacity-50"
          disabled={!canQueue}
          onClick={addRuleToQueue}
        >
          Agregar regla a la cola
        </button>

        <button
          type="button"
          className="px-3 py-2 rounded bg-indigo-700 text-white disabled:opacity-50"
          disabled={busy || queue.length === 0}
          onClick={sendToBackend}
          title="Enviar al backend"
        >
          {busy ? "Enviando…" : "Enviar al backend"}
        </button>

        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>

      {/* Cola */}
      <section className="space-y-2">
        <div className="font-medium">Reglas en cola</div>
        {queue.length === 0 ? (
          <div className="text-sm text-gray-500">No hay reglas en cola.</div>
        ) : (
          <ul className="divide-y">
            {queue.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <div className="text-sm">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-gray-500">
                    {r.model} • {r.scopeMode === "roomType" ? r.roomTypes.join(", ") : `${r.roomIds.length} habs.`}
                  </div>
                </div>
                <button
                  type="button"
                  className="px-2 py-1 rounded bg-gray-700 text-white"
                  onClick={() => removeFromQueue(r.id)}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Placeholder backend */}
      <section className="space-y-2">
        <div className="font-medium">Tarifas actuales (backend)</div>
        <div className="text-sm text-gray-500">
          (Conecta un GET a tu API para listarlas aquí. Este componente no modifica el store local.)
        </div>
      </section>
    </div>
  );
}
