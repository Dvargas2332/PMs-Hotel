import React, { useEffect, useMemo, useState } from "react";
import { X as XIcon } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { api } from "../../../lib/api";

const PLAN_COLORS = [
  { header: "bg-emerald-50 border-emerald-200 text-emerald-800", cell: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { header: "bg-sky-50 border-sky-200 text-sky-800", cell: "bg-sky-50 border-sky-200 text-sky-800" },
  { header: "bg-amber-50 border-amber-200 text-amber-800", cell: "bg-amber-50 border-amber-200 text-amber-800" },
  { header: "bg-indigo-50 border-indigo-200 text-indigo-800", cell: "bg-indigo-50 border-indigo-200 text-indigo-800" },
  { header: "bg-rose-50 border-rose-200 text-rose-800", cell: "bg-rose-50 border-rose-200 text-rose-800" },
];

export default function RatePlans() {
  const [items, setItems] = useState([]);
  const [viewStart, setViewStart] = useState(new Date()); // ventana de 15 días
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    currency: "CRC",
    derived: false,
    price: 0,
    dateFrom: "",
    dateTo: "",
    restrictions: { LOSMin: 1, LOSMax: 30 },
  });
  const [daily, setDaily] = useState({
    name: "",
    price: "",
    currency: "CRC",
    from: "",
    to: "",
  });

  const load = async () => {
    const { data } = await api.get("/api/ratePlans");
    setItems(data || []);
  };
  useEffect(() => {
    load();
  }, []);

  const resetForm = () =>
    setForm({
      id: "",
      name: "",
      currency: "CRC",
      derived: false,
      price: 0,
      dateFrom: "",
      dateTo: "",
      restrictions: { LOSMin: 1, LOSMax: 30 },
    });

  const onCreate = async () => {
    const payload = {
      ...form,
      price: Number(form.price || 0),
      restrictions: {
        LOSMin: Number(form.restrictions.LOSMin || 1),
        LOSMax: Number(form.restrictions.LOSMax || 30),
      },
      dateFrom: form.dateFrom || undefined,
      dateTo: form.dateTo || undefined,
    };
    const { data } = await api.post("/api/ratePlans", payload);
    setItems((prev) => [...prev, data]);
    resetForm();
    setShowModal(false);
  };

  const onApplyDaily = async () => {
    if (!daily.price || !daily.from || !daily.to) return;
    if (daily.from > daily.to) return alert("La fecha 'desde' debe ser menor o igual a 'hasta'.");
    const payload = {
      name: daily.name || `Tarifa ${daily.price} ${daily.currency}`,
      price: Number(daily.price),
      currency: daily.currency || "CRC",
      derived: false,
      dateFrom: daily.from,
      dateTo: daily.to,
    };
    const { data } = await api.post("/api/ratePlans", payload);
    setItems((prev) => [...prev, data]);
    setDaily({ name: "", price: "", currency: payload.currency, from: "", to: "" });
  };

  const windowLabel = useMemo(() => {
    const end = new Date(viewStart);
    end.setDate(end.getDate() + 14);
    return `${viewStart.toLocaleDateString("en-CR")} - ${end.toLocaleDateString("en-CR")}`;
  }, [viewStart]);

  const windowDays = useMemo(() => {
    const days = [];
    const start = new Date(viewStart);
    for (let i = 0; i < 15; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [viewStart]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Rate plans</h2>
        <Button onClick={() => setShowModal(true)}>New rate plan</Button>
      </div>

      {/* Rate calendar (15-day window) */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Rate calendar (15 days)</h4>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Button
              variant="outline"
              onClick={() =>
                setViewStart((d) => {
                  const next = new Date(d);
                  next.setDate(d.getDate() - 15);
                  return next;
                })
              }
            >
              &lt; Prev 15
            </Button>
            <span className="font-semibold capitalize">{windowLabel}</span>
            <Button
              variant="outline"
              onClick={() =>
                setViewStart((d) => {
                  const next = new Date(d);
                  next.setDate(d.getDate() + 15);
                  return next;
                })
              }
            >
              Next 15 &gt;
            </Button>
            <input
              type="date"
              className="border rounded px-2 py-1 text-xs"
              value={viewStart.toISOString().slice(0, 10)}
              onChange={(e) => setViewStart(new Date(e.target.value))}
            />
          </div>
        </div>

        <div className="overflow-x-auto pb-2 touch-pan-x">
          {/* Day header */}
          <div className="grid grid-flow-col auto-cols-[minmax(100px,1fr)] min-w-full gap-1 text-[11px] text-slate-500 uppercase mb-2">
            <div className="sticky left-0 z-10 bg-white border rounded-lg px-3 py-2 text-slate-700 font-semibold">
              Rate plan
            </div>
            {windowDays.map((day) => (
              <div key={day.toISOString()} className="py-1 text-center bg-white border rounded-lg">
                <div className="capitalize">{day.toLocaleDateString("en-CR", { weekday: "short" })}</div>
                <div className="font-semibold text-slate-700 text-xs">{day.getDate()}</div>
              </div>
            ))}
          </div>
          {/* Rows per plan */}
          <div className="space-y-2 min-w-full">
            {items.map((plan, idx) => {
              const colors = PLAN_COLORS[idx % PLAN_COLORS.length];
              return (
                <div
                  key={plan.id || plan.name}
                  className="grid grid-flow-col auto-cols-[minmax(100px,1fr)] gap-1 text-sm"
                >
                  <div className={`sticky left-0 z-10 border rounded-lg px-3 py-2 font-semibold shadow-sm ${colors.header}`}>
                    {plan.name}
                    <div className="text-[11px] text-slate-500">{plan.currency}</div>
                  </div>
                  {windowDays.map((day) => {
                    const time = day.getTime();
                    const from = plan.dateFrom ? new Date(plan.dateFrom).getTime() : null;
                    const to = plan.dateTo ? new Date(plan.dateTo).getTime() : null;
                    const active = (!from || time >= from) && (!to || time <= to);
                    return (
                      <div
                        key={`${plan.id}-${day.toISOString()}`}
                        className={`rounded-lg p-2 min-h-[70px] shadow-sm ${
                          active ? colors.cell : "border border-slate-100 bg-white text-slate-400"
                        }`}
                      >
                        {active ? (
                          <>
                            <div className="text-[12px] font-semibold">
                              {plan.currency} {plan.price}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate">{plan.name}</div>
                          </>
                        ) : (
                          <div className="text-[11px]">—</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Apply price range */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Apply price for date range</h4>
          <div className="text-xs text-slate-500">Define a date range and the price will be applied on the calendar.</div>
        </div>
        <div className="grid md:grid-cols-5 gap-2 items-end">
          <Input placeholder="Name (optional)" value={daily.name} onChange={(e)=>setDaily((f)=>({...f,name:e.target.value}))}/>
          <Input placeholder="Price" type="number" money value={daily.price} onChange={(e)=>setDaily((f)=>({...f,price:e.target.value}))}/>
          <Input placeholder="Currency" value={daily.currency} onChange={(e)=>setDaily((f)=>({...f,currency:e.target.value}))}/>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={daily.from} onChange={(e)=>setDaily((f)=>({...f,from:e.target.value}))}/>
            <Input type="date" value={daily.to} onChange={(e)=>setDaily((f)=>({...f,to:e.target.value}))}/>
          </div>
          <Button onClick={onApplyDaily} disabled={!daily.price || !daily.from || !daily.to}>Apply</Button>
        </div>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">New rate plan</h3>
                <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => setShowModal(false)}>
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <Input placeholder="ID" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} />
                <Input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                <Input placeholder="Currency" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
                <Input placeholder="Base price" type="number" money value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                <Input placeholder="From" type="date" value={form.dateFrom} onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))} />
                <Input placeholder="To" type="date" value={form.dateTo} onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))} />
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.derived} onChange={(v) => setForm((f) => ({ ...f, derived: v }))} label="Derived" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="LOS Min"
                    type="number"
                    value={form.restrictions.LOSMin}
                    onChange={(e) => setForm((f) => ({ ...f, restrictions: { ...f.restrictions, LOSMin: e.target.value } }))}
                  />
                  <Input
                    placeholder="LOS Max"
                    type="number"
                    value={form.restrictions.LOSMax}
                    onChange={(e) => setForm((f) => ({ ...f, restrictions: { ...f.restrictions, LOSMax: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button onClick={onCreate}>Save</Button>
              </div>

              <div className="text-xs text-slate-500">
                Select the date range where this rate plan is active. After saving, it will appear in the rate calendar/list.
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
