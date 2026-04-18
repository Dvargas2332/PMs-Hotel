import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Check, Pencil, Trash2, Lock, Unlock } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { CustomSelect } from "../../../components/ui/CustomSelect";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

const PLAN_COLORS = [
  { bg: "bg-emerald-100 text-emerald-900", badge: "bg-emerald-500", light: "#d1fae5", border: "#6ee7b7" },
  { bg: "bg-sky-100 text-sky-900",         badge: "bg-sky-500",     light: "#e0f2fe", border: "#7dd3fc" },
  { bg: "bg-amber-100 text-amber-900",     badge: "bg-amber-500",   light: "#fef3c7", border: "#fcd34d" },
  { bg: "bg-violet-100 text-violet-900",   badge: "bg-violet-500",  light: "#ede9fe", border: "#c4b5fd" },
  { bg: "bg-rose-100 text-rose-900",       badge: "bg-rose-500",    light: "#ffe4e6", border: "#fda4af" },
];

function toYMD(d) {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function buildDays(year, month) {
  const count = daysInMonth(year, month);
  return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
}

const WEEKDAY_SHORT = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];

const EMPTY_PLAN = {
  id: "", name: "", currency: "CRC", price: 0,
  derived: false, dateFrom: "", dateTo: "",
  restrictions: { LOSMin: 1, LOSMax: 30 },
};

export default function RatePlans() {
  const { t } = useLanguage();

  // ── state ────────────────────────────────────────────────────────────
  const [plans,     setPlans]     = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [overrides, setOverrides] = useState({}); // { "planId|roomTypeId|YYYY-MM-DD": override }

  const today = new Date();
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selPlan,  setSelPlan]  = useState(null); // selected ratePlan id

  const [planModal,   setPlanModal]   = useState(false);
  const [editingPlan, setEditingPlan] = useState(null); // null = new
  const [planForm,    setPlanForm]    = useState(EMPTY_PLAN);
  const [planSaving,  setPlanSaving]  = useState(false);

  const [bulkModal,  setBulkModal]  = useState(false);
  const [bulkForm,   setBulkForm]   = useState({ roomTypeId: "", dateFrom: "", dateTo: "", price: "", closed: false });
  const [bulkSaving, setBulkSaving] = useState(false);

  const [editingCell, setEditingCell] = useState(null); // "planId|roomTypeId|YYYY-MM-DD"
  const [cellVal,     setCellVal]     = useState("");
  const cellInputRef = useRef(null);

  // ── load ──────────────────────────────────────────────────────────────
  const loadPlans = useCallback(async () => {
    try { const { data } = await api.get("/ratePlans"); setPlans(data || []); } catch {}
  }, []);

  const loadRoomTypes = useCallback(async () => {
    try { const { data } = await api.get("/roomTypes"); setRoomTypes(data || []); } catch {}
  }, []);

  const loadOverrides = useCallback(async (planId) => {
    if (!planId) return;
    const month = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
    try {
      const { data } = await api.get(`/rateOverrides?ratePlanId=${planId}&month=${month}`);
      const map = {};
      (data || []).forEach((o) => {
        const key = `${o.ratePlanId}|${o.roomTypeId}|${toYMD(new Date(o.date))}`;
        map[key] = o;
      });
      setOverrides((prev) => ({ ...prev, ...map }));
    } catch {}
  }, [calYear, calMonth]);

  useEffect(() => { loadPlans(); loadRoomTypes(); }, []);
  useEffect(() => {
    if (selPlan) loadOverrides(selPlan);
  }, [selPlan, calYear, calMonth]);

  // auto-select first plan
  useEffect(() => {
    if (!selPlan && plans.length > 0) setSelPlan(plans[0].id);
  }, [plans]);

  // ── calendar days ─────────────────────────────────────────────────────
  const days = useMemo(() => buildDays(calYear, calMonth), [calYear, calMonth]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  // ── selected plan data ────────────────────────────────────────────────
  const plan = useMemo(() => plans.find(p => p.id === selPlan), [plans, selPlan]);
  const planColor = useMemo(() => {
    const idx = plans.findIndex(p => p.id === selPlan);
    return PLAN_COLORS[idx % PLAN_COLORS.length] || PLAN_COLORS[0];
  }, [plans, selPlan]);

  function getOverride(roomTypeId, day) {
    return overrides[`${selPlan}|${roomTypeId}|${toYMD(day)}`];
  }
  function getPrice(roomTypeId, day) {
    const ov = getOverride(roomTypeId, day);
    if (ov) return ov.price;
    return plan?.price ?? "—";
  }
  function isClosed(roomTypeId, day) {
    return getOverride(roomTypeId, day)?.closed ?? false;
  }
  function isOverridden(roomTypeId, day) {
    return !!overrides[`${selPlan}|${roomTypeId}|${toYMD(day)}`];
  }

  // ── inline cell edit ──────────────────────────────────────────────────
  function startEdit(roomTypeId, day) {
    if (!selPlan) return;
    const key = `${selPlan}|${roomTypeId}|${toYMD(day)}`;
    setEditingCell(key);
    setCellVal(String(getPrice(roomTypeId, day)));
    setTimeout(() => cellInputRef.current?.select(), 30);
  }

  async function commitEdit(roomTypeId, day) {
    if (!selPlan) return;
    const price = parseFloat(cellVal);
    if (isNaN(price)) { setEditingCell(null); return; }
    const key = `${selPlan}|${roomTypeId}|${toYMD(day)}`;
    try {
      const { data } = await api.put("/rateOverrides", {
        ratePlanId: selPlan, roomTypeId, date: toYMD(day), price,
        closed: overrides[key]?.closed ?? false,
      });
      setOverrides(prev => ({ ...prev, [key]: data }));
    } catch {}
    setEditingCell(null);
  }

  async function toggleClosed(roomTypeId, day) {
    if (!selPlan) return;
    const key = `${selPlan}|${roomTypeId}|${toYMD(day)}`;
    const cur = overrides[key];
    const closed = !(cur?.closed ?? false);
    const price = cur ? Number(cur.price) : Number(plan?.price ?? 0);
    try {
      const { data } = await api.put("/rateOverrides", {
        ratePlanId: selPlan, roomTypeId, date: toYMD(day), price, closed,
      });
      setOverrides(prev => ({ ...prev, [key]: data }));
    } catch {}
  }

  async function clearOverride(roomTypeId, day) {
    const key = `${selPlan}|${roomTypeId}|${toYMD(day)}`;
    const ov = overrides[key];
    if (!ov) return;
    try {
      await api.delete(`/rateOverrides/${ov.id}`);
      setOverrides(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch {}
  }

  // ── plan CRUD ─────────────────────────────────────────────────────────
  function openNewPlan() { setEditingPlan(null); setPlanForm(EMPTY_PLAN); setPlanModal(true); }
  function openEditPlan(p) {
    setEditingPlan(p);
    setPlanForm({
      id: p.id, name: p.name, currency: p.currency,
      price: Number(p.price), derived: p.derived,
      dateFrom: p.dateFrom ? toYMD(new Date(p.dateFrom)) : "",
      dateTo:   p.dateTo   ? toYMD(new Date(p.dateTo))   : "",
      restrictions: p.restrictions ?? { LOSMin: 1, LOSMax: 30 },
    });
    setPlanModal(true);
  }

  async function savePlan() {
    setPlanSaving(true);
    const payload = {
      ...planForm,
      price: Number(planForm.price || 0),
      restrictions: {
        LOSMin: Number(planForm.restrictions?.LOSMin || 1),
        LOSMax: Number(planForm.restrictions?.LOSMax || 30),
      },
      dateFrom: planForm.dateFrom || undefined,
      dateTo:   planForm.dateTo   || undefined,
    };
    try {
      if (editingPlan) {
        const { data } = await api.put(`/ratePlans/${editingPlan.id}`, payload);
        setPlans(prev => prev.map(p => p.id === data.id ? data : p));
      } else {
        const { data } = await api.post("/ratePlans", payload);
        setPlans(prev => [...prev, data]);
        setSelPlan(data.id);
      }
      setPlanModal(false);
    } catch {}
    setPlanSaving(false);
  }

  async function deletePlan(p) {
    if (!confirm(`¿Eliminar plan "${p.name}"?`)) return;
    try {
      await api.delete(`/ratePlans/${p.id}`);
      setPlans(prev => prev.filter(x => x.id !== p.id));
      if (selPlan === p.id) setSelPlan(plans.find(x => x.id !== p.id)?.id ?? null);
    } catch {}
  }

  // ── bulk apply ────────────────────────────────────────────────────────
  async function applyBulk() {
    if (!selPlan || !bulkForm.dateFrom || !bulkForm.dateTo) return;
    setBulkSaving(true);
    const targets = bulkForm.roomTypeId ? [bulkForm.roomTypeId] : roomTypes.map(rt => rt.id);
    try {
      const allResults = [];
      for (const rtId of targets) {
        const { data } = await api.put("/rateOverrides/bulk", {
          ratePlanId: selPlan, roomTypeId: rtId,
          dateFrom:   bulkForm.dateFrom, dateTo: bulkForm.dateTo,
          price:      Number(bulkForm.price || plan?.price || 0),
          closed:     bulkForm.closed,
        });
        allResults.push(...(data || []));
      }
      const map = {};
      allResults.forEach((o) => {
        map[`${o.ratePlanId}|${o.roomTypeId}|${toYMD(new Date(o.date))}`] = o;
      });
      setOverrides(prev => ({ ...prev, ...map }));
      setBulkModal(false);
      setBulkForm({ roomTypeId: "", dateFrom: "", dateTo: "", price: "", closed: false });
    } catch {}
    setBulkSaving(false);
  }

  // ── render ────────────────────────────────────────────────────────────
  const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">{t("mgmt.ratePlans.title")}</h2>
        <Button onClick={openNewPlan} className="flex items-center gap-1">
          <Plus className="w-4 h-4" /> {t("mgmt.ratePlans.new")}
        </Button>
      </div>

      {/* ── Plan selector tabs ── */}
      <div className="flex flex-wrap gap-2">
        {plans.map((p, idx) => {
          const c = PLAN_COLORS[idx % PLAN_COLORS.length];
          const active = p.id === selPlan;
          return (
            <div key={p.id} className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 text-sm font-medium cursor-pointer transition ${active ? c.bg + " border-current shadow-sm" : "border-white/10 text-slate-400 hover:text-slate-200"}`}
              onClick={() => setSelPlan(p.id)}>
              <span className={`w-2 h-2 rounded-full ${c.badge}`} />
              {p.name}
              <span className="text-[11px] opacity-60 ml-1">{p.currency}</span>
              <button className="ml-1 opacity-50 hover:opacity-100" onClick={e => { e.stopPropagation(); openEditPlan(p); }}>
                <Pencil className="w-3 h-3" />
              </button>
              <button className="opacity-50 hover:opacity-100 hover:text-rose-400" onClick={e => { e.stopPropagation(); deletePlan(p); }}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        {plans.length === 0 && <span className="text-sm text-slate-500">Sin planes tarifarios. Crea uno.</span>}
      </div>

      {/* ── Calendar card ── */}
      {plan && (
        <Card className="p-3 space-y-2 overflow-hidden">
          {/* nav */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1 rounded hover:bg-white/10"><ChevronLeft className="w-4 h-4"/></button>
              <span className="font-semibold text-sm capitalize">{MONTH_NAMES[calMonth]} {calYear}</span>
              <button onClick={nextMonth} className="p-1 rounded hover:bg-white/10"><ChevronRight className="w-4 h-4"/></button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Precio base: <span className="font-semibold text-slate-200">{plan.currency} {Number(plan.price).toLocaleString()}</span></span>
              <Button variant="outline" onClick={() => { setBulkForm(f => ({ ...f, dateFrom: toYMD(days[0]), dateTo: toYMD(days[days.length-1]) })); setBulkModal(true); }}>
                Aplicar rango
              </Button>
            </div>
          </div>

          {/* grid */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] border-separate border-spacing-[2px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-800 rounded-lg px-2 py-1.5 text-left text-slate-200 font-semibold min-w-[120px]">
                    Tipo de hab.
                  </th>
                  {days.map(d => {
                    const isToday = toYMD(d) === toYMD(today);
                    const dow = d.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    return (
                      <th key={toYMD(d)} className={`text-center rounded-lg px-1 py-1 min-w-[62px] font-medium ${isToday ? "bg-indigo-600 text-white" : isWeekend ? "bg-white/10 text-slate-300" : "bg-white/5 text-slate-400"}`}>
                        <div>{WEEKDAY_SHORT[dow]}</div>
                        <div className="font-bold text-[12px]">{d.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {roomTypes.length === 0 && (
                  <tr><td colSpan={days.length + 1} className="text-center text-slate-500 py-4 text-xs">Sin tipos de habitación configurados</td></tr>
                )}
                {roomTypes.map((rt) => (
                  <tr key={rt.id}>
                    <td className="sticky left-0 z-10 bg-slate-800 rounded-lg px-2 py-1.5 font-medium text-slate-100">
                      {rt.name}<div className="text-[10px] text-slate-400">{rt.id}</div>
                    </td>
                    {days.map(d => {
                      const ymd = toYMD(d);
                      const cellKey = `${selPlan}|${rt.id}|${ymd}`;
                      const isEditing = editingCell === cellKey;
                      const ovr = getOverride(rt.id, d);
                      const closed = isClosed(rt.id, d);
                      const overridden = isOverridden(rt.id, d);
                      const price = getPrice(rt.id, d);
                      const dow = d.getDay();
                      const isWeekend = dow === 0 || dow === 6;

                      return (
                        <td key={ymd}
                          className={`rounded-lg relative group cursor-pointer transition
                            ${closed ? "bg-red-900/40 text-red-300" :
                              overridden ? "text-slate-100" :
                              isWeekend ? "bg-white/5 text-slate-300" : "bg-white/3 text-slate-400"}
                          `}
                          style={overridden && !closed ? { backgroundColor: planColor.light + "22", borderColor: planColor.border } : {}}
                          onClick={() => !isEditing && startEdit(rt.id, d)}
                        >
                          {isEditing ? (
                            <div className="flex items-center p-0.5" onClick={e => e.stopPropagation()}>
                              <input
                                ref={cellInputRef}
                                className="w-full bg-indigo-900 text-white text-[11px] rounded px-1 py-0.5 outline-none"
                                value={cellVal}
                                onChange={e => setCellVal(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") commitEdit(rt.id, d);
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                                onBlur={() => commitEdit(rt.id, d)}
                                autoFocus
                              />
                              <button className="ml-0.5 text-emerald-400" onMouseDown={e => { e.preventDefault(); commitEdit(rt.id, d); }}>
                                <Check className="w-3 h-3"/>
                              </button>
                            </div>
                          ) : (
                            <div className="px-1 py-1 min-h-[42px] flex flex-col justify-between">
                              <span className={`font-semibold text-[12px] ${closed ? "line-through" : ""}`}>
                                {typeof price === "number" ? price.toLocaleString() : price}
                              </span>
                              {closed && <span className="text-[9px] uppercase tracking-wide font-bold text-red-400">Cerrado</span>}
                              {overridden && !closed && <span className="text-[9px] text-indigo-300">override</span>}
                              {/* action buttons on hover */}
                              <div className="absolute top-0.5 right-0.5 hidden group-hover:flex gap-0.5">
                                <button
                                  className={`rounded p-0.5 ${closed ? "bg-emerald-600/80 text-white" : "bg-red-600/80 text-white"}`}
                                  title={closed ? "Abrir" : "Cerrar"}
                                  onClick={e => { e.stopPropagation(); toggleClosed(rt.id, d); }}
                                >
                                  {closed ? <Unlock className="w-2.5 h-2.5"/> : <Lock className="w-2.5 h-2.5"/>}
                                </button>
                                {overridden && (
                                  <button className="rounded p-0.5 bg-slate-600/80 text-white" title="Quitar override"
                                    onClick={e => { e.stopPropagation(); clearOverride(rt.id, d); }}>
                                    <X className="w-2.5 h-2.5"/>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* legend */}
          <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-1 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white/5 inline-block"/><span>Precio base del plan</span></span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-500/30 inline-block border border-indigo-400"/><span>Override manual</span></span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900/40 inline-block"/><span>Cerrado</span></span>
            <span className="text-slate-500">Click en celda para editar precio · Hover para cerrar/quitar override</span>
          </div>
        </Card>
      )}

      {/* ── Plan modal ── */}
      {planModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editingPlan ? "Editar plan tarifario" : t("mgmt.ratePlans.new")}</h3>
              <button onClick={() => setPlanModal(false)}><X className="w-4 h-4 text-slate-400"/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder={t("mgmt.ratePlans.id")} value={planForm.id}
                onChange={e => setPlanForm(f => ({ ...f, id: e.target.value }))}
                disabled={!!editingPlan} />
              <Input placeholder={t("mgmt.ratePlans.name")} value={planForm.name}
                onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} />
              <CustomSelect className="h-10" value={planForm.currency}
                onChange={e => setPlanForm(f => ({ ...f, currency: e.target.value }))}>
                <option value="CRC">CRC</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </CustomSelect>
              <Input placeholder={t("mgmt.ratePlans.basePrice")} type="number" value={planForm.price}
                onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))} />
              <Input placeholder={t("mgmt.ratePlans.from")} type="date" value={planForm.dateFrom}
                onChange={e => setPlanForm(f => ({ ...f, dateFrom: e.target.value }))} />
              <Input placeholder={t("mgmt.ratePlans.to")} type="date" value={planForm.dateTo}
                onChange={e => setPlanForm(f => ({ ...f, dateTo: e.target.value }))} />
              <Input placeholder={t("mgmt.ratePlans.losMin")} type="number" value={planForm.restrictions?.LOSMin ?? 1}
                onChange={e => setPlanForm(f => ({ ...f, restrictions: { ...f.restrictions, LOSMin: e.target.value } }))} />
              <Input placeholder={t("mgmt.ratePlans.losMax")} type="number" value={planForm.restrictions?.LOSMax ?? 30}
                onChange={e => setPlanForm(f => ({ ...f, restrictions: { ...f.restrictions, LOSMax: e.target.value } }))} />
              <div className="col-span-2">
                <Checkbox checked={planForm.derived} onChange={v => setPlanForm(f => ({ ...f, derived: v }))} label={t("mgmt.ratePlans.derived")} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPlanModal(false)}>{t("common.cancel")}</Button>
              <Button onClick={savePlan} disabled={planSaving || !planForm.name}>
                {planSaving ? "Guardando..." : t("common.save")}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Bulk apply modal ── */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Aplicar tarifa en rango</h3>
              <button onClick={() => setBulkModal(false)}><X className="w-4 h-4 text-slate-400"/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tipo de habitación</label>
                <CustomSelect className="h-10 w-full" value={bulkForm.roomTypeId}
                  onChange={e => setBulkForm(f => ({ ...f, roomTypeId: e.target.value }))}>
                  <option value="">Todos los tipos</option>
                  {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
                </CustomSelect>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Desde</label>
                  <Input type="date" value={bulkForm.dateFrom} onChange={e => setBulkForm(f => ({ ...f, dateFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Hasta</label>
                  <Input type="date" value={bulkForm.dateTo} onChange={e => setBulkForm(f => ({ ...f, dateTo: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Precio (vacío = precio base del plan)</label>
                <Input type="number" placeholder={String(plan?.price ?? 0)} value={bulkForm.price}
                  onChange={e => setBulkForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <Checkbox checked={bulkForm.closed} onChange={v => setBulkForm(f => ({ ...f, closed: v }))} label="Marcar como cerrado" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkModal(false)}>{t("common.cancel")}</Button>
              <Button onClick={applyBulk} disabled={bulkSaving || !bulkForm.dateFrom || !bulkForm.dateTo || !selPlan}>
                {bulkSaving ? "Aplicando..." : "Aplicar"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
