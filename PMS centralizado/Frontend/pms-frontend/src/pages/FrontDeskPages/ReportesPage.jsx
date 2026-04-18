import React, { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { BarChart2, Users, TrendingUp, Home, RefreshCw } from "lucide-react";

function fmt(n, decimals = 0) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border bg-white shadow-sm p-4 ${className}`}>{children}</div>;
}

function KpiBox({ label, value, sub, color = "text-slate-800" }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm flex flex-col gap-1">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function OccupancyBar({ pct }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date().toISOString().slice(0, 7) + "-01";

export default function ReportesPage() {
  const [tab, setTab] = useState("flash");

  // Flash diario
  const [flash, setFlash]         = useState(null);
  const [flashDate, setFlashDate] = useState(today());
  const [flashLoading, setFlashLoading] = useState(false);

  // Ocupación
  const [occ, setOcc]           = useState([]);
  const [occFrom, setOccFrom]   = useState(monthStart());
  const [occTo, setOccTo]       = useState(today());
  const [occLoading, setOccLoading] = useState(false);

  // Ingresos
  const [rev, setRev]           = useState(null);
  const [revFrom, setRevFrom]   = useState(monthStart());
  const [revTo, setRevTo]       = useState(today());
  const [revLoading, setRevLoading] = useState(false);

  // Llegadas/Salidas
  const [ad, setAd]             = useState(null);
  const [adDate, setAdDate]     = useState(today());
  const [adLoading, setAdLoading] = useState(false);

  // Housekeeping
  const [hk, setHk]             = useState([]);
  const [hkLoading, setHkLoading] = useState(false);

  const loadFlash = useCallback(async () => {
    setFlashLoading(true);
    try {
      const { data } = await api.get(`/reports/daily?date=${flashDate}`);
      setFlash(data);
    } catch {}
    setFlashLoading(false);
  }, [flashDate]);

  const loadOcc = useCallback(async () => {
    setOccLoading(true);
    try {
      const { data } = await api.get(`/reports/occupancy?from=${occFrom}&to=${occTo}`);
      setOcc(Array.isArray(data) ? data : []);
    } catch {}
    setOccLoading(false);
  }, [occFrom, occTo]);

  const loadRev = useCallback(async () => {
    setRevLoading(true);
    try {
      const { data } = await api.get(`/reports/revenue?from=${revFrom}&to=${revTo}`);
      setRev(data);
    } catch {}
    setRevLoading(false);
  }, [revFrom, revTo]);

  const loadAD = useCallback(async () => {
    setAdLoading(true);
    try {
      const { data } = await api.get(`/reports/arrivals-departures?date=${adDate}`);
      setAd(data);
    } catch {}
    setAdLoading(false);
  }, [adDate]);

  const loadHK = useCallback(async () => {
    setHkLoading(true);
    try {
      const { data } = await api.get("/reports/housekeeping");
      setHk(Array.isArray(data) ? data : []);
    } catch {}
    setHkLoading(false);
  }, []);

  useEffect(() => { if (tab === "flash") loadFlash(); }, [tab, loadFlash]);
  useEffect(() => { if (tab === "occupancy") loadOcc(); }, [tab, loadOcc]);
  useEffect(() => { if (tab === "revenue") loadRev(); }, [tab, loadRev]);
  useEffect(() => { if (tab === "ad") loadAD(); }, [tab, loadAD]);
  useEffect(() => { if (tab === "housekeeping") loadHK(); }, [tab, loadHK]);

  const TABS = [
    { key: "flash",       label: "Flash diario",       icon: TrendingUp },
    { key: "occupancy",   label: "Ocupación",           icon: BarChart2  },
    { key: "revenue",     label: "Ingresos",            icon: TrendingUp },
    { key: "ad",          label: "Llegadas / Salidas",  icon: Users      },
    { key: "housekeeping",label: "Housekeeping",        icon: Home       },
  ];

  const HK_COLORS = {
    AVAILABLE:   "bg-emerald-100 text-emerald-700",
    OCCUPIED:    "bg-red-100 text-red-700",
    CLEANING:    "bg-amber-100 text-amber-700",
    MAINTENANCE: "bg-yellow-100 text-yellow-700",
    BLOCKED:     "bg-gray-100 text-gray-600",
  };

  return (
    <div className="p-5 space-y-5 min-h-screen bg-slate-50">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Reportes</h1>
        <p className="text-sm text-slate-500">Datos operacionales en tiempo real.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition
              ${tab === key ? "bg-emerald-600 text-white border-emerald-600 shadow" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Flash diario ── */}
      {tab === "flash" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={flashDate} onChange={e => setFlashDate(e.target.value)} />
            <button onClick={loadFlash} disabled={flashLoading} className="flex items-center gap-1 px-3 py-2 rounded-lg border text-sm hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 ${flashLoading ? "animate-spin" : ""}`} /> Actualizar
            </button>
          </div>
          {flash && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiBox label="Ocupación" value={`${flash.occupancyPct}%`} sub={`${flash.inHouse} / ${flash.totalRooms} hab.`} color={flash.occupancyPct >= 70 ? "text-emerald-600" : "text-amber-500"} />
              <KpiBox label="En casa" value={flash.inHouse} sub="huéspedes activos" />
              <KpiBox label="Llegadas hoy" value={flash.arrivals} color="text-sky-600" />
              <KpiBox label="Salidas hoy" value={flash.departures} color="text-indigo-600" />
              <KpiBox label="Ingresos del día" value={`${flash.currency} ${fmt(flash.revenue, 2)}`} sub={`${flash.invoiceCount} facturas`} color="text-emerald-700" />
            </div>
          )}
          {!flash && !flashLoading && <p className="text-sm text-slate-400">Sin datos para esta fecha.</p>}
        </div>
      )}

      {/* ── Ocupación ── */}
      {tab === "occupancy" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <label>Desde</label>
              <input type="date" className="border rounded-lg px-3 py-2" value={occFrom} onChange={e => setOccFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label>Hasta</label>
              <input type="date" className="border rounded-lg px-3 py-2" value={occTo} onChange={e => setOccTo(e.target.value)} />
            </div>
            <button onClick={loadOcc} disabled={occLoading} className="flex items-center gap-1 px-3 py-2 rounded-lg border text-sm hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 ${occLoading ? "animate-spin" : ""}`} /> Aplicar
            </button>
          </div>
          {occ.length > 0 && (
            <Card>
              <table className="min-w-full text-xs">
                <thead className="text-slate-500 border-b">
                  <tr>
                    <th className="py-2 pr-4 text-left">Fecha</th>
                    <th className="py-2 pr-4 text-right">Ocupadas</th>
                    <th className="py-2 pr-4 text-right">Total</th>
                    <th className="py-2 text-left min-w-[140px]">Ocupación %</th>
                  </tr>
                </thead>
                <tbody>
                  {occ.map(row => (
                    <tr key={row.date} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-1.5 pr-4 font-medium">{row.date}</td>
                      <td className="py-1.5 pr-4 text-right">{row.occupied}</td>
                      <td className="py-1.5 pr-4 text-right">{row.totalRooms}</td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-10 text-right font-semibold">{row.occupancyPct}%</span>
                          <OccupancyBar pct={row.occupancyPct} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {occ.length === 0 && !occLoading && <p className="text-sm text-slate-400">Sin datos en el rango seleccionado.</p>}
        </div>
      )}

      {/* ── Ingresos ── */}
      {tab === "revenue" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <label>Desde</label>
              <input type="date" className="border rounded-lg px-3 py-2" value={revFrom} onChange={e => setRevFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label>Hasta</label>
              <input type="date" className="border rounded-lg px-3 py-2" value={revTo} onChange={e => setRevTo(e.target.value)} />
            </div>
            <button onClick={loadRev} disabled={revLoading} className="flex items-center gap-1 px-3 py-2 rounded-lg border text-sm hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 ${revLoading ? "animate-spin" : ""}`} /> Aplicar
            </button>
          </div>
          {rev && (
            <>
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <KpiBox label="Total del período" value={`${rev.currency} ${fmt(rev.totalRevenue, 2)}`} color="text-emerald-700" />
                <KpiBox label="Días con ingresos" value={rev.days?.length ?? 0} />
              </div>
              {rev.days?.length > 0 && (
                <Card>
                  <table className="min-w-full text-xs">
                    <thead className="text-slate-500 border-b">
                      <tr>
                        <th className="py-2 pr-4 text-left">Fecha</th>
                        <th className="py-2 pr-4 text-right">Facturas</th>
                        <th className="py-2 text-right">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rev.days.map(row => (
                        <tr key={row.date} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="py-1.5 pr-4 font-medium">{row.date}</td>
                          <td className="py-1.5 pr-4 text-right">{row.invoices}</td>
                          <td className="py-1.5 text-right font-semibold text-emerald-700">{row.currency} {fmt(row.revenue, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </>
          )}
          {!rev && !revLoading && <p className="text-sm text-slate-400">Sin datos en el rango seleccionado.</p>}
        </div>
      )}

      {/* ── Llegadas / Salidas ── */}
      {tab === "ad" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={adDate} onChange={e => setAdDate(e.target.value)} />
            <button onClick={loadAD} disabled={adLoading} className="flex items-center gap-1 px-3 py-2 rounded-lg border text-sm hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 ${adLoading ? "animate-spin" : ""}`} /> Actualizar
            </button>
          </div>
          {ad && (
            <div className="grid md:grid-cols-2 gap-5">
              {[{ label: "Llegadas", list: ad.arrivals, color: "text-sky-700", dateProp: "checkIn" },
                { label: "Salidas",  list: ad.departures, color: "text-indigo-700", dateProp: "checkOut" }]
                .map(({ label, list, color, dateProp }) => (
                <Card key={label}>
                  <h3 className={`font-semibold text-sm mb-3 ${color}`}>{label} ({list.length})</h3>
                  {list.length === 0 ? <p className="text-xs text-slate-400">Sin registros.</p> : (
                    <table className="min-w-full text-xs">
                      <thead className="text-slate-400 border-b">
                        <tr>
                          <th className="py-1 pr-2 text-left">Hab.</th>
                          <th className="py-1 pr-2 text-left">Huésped</th>
                          <th className="py-1 pr-2 text-left">Tarifa</th>
                          <th className="py-1 text-left">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map(r => (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="py-1 pr-2 font-bold">#{r.room?.number}</td>
                            <td className="py-1 pr-2">{r.guest?.firstName} {r.guest?.lastName}</td>
                            <td className="py-1 pr-2">{r.ratePlan?.name || "-"}</td>
                            <td className="py-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.status === "CHECKED_IN" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Housekeeping ── */}
      {tab === "housekeeping" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={loadHK} disabled={hkLoading} className="flex items-center gap-1 px-3 py-2 rounded-lg border text-sm hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 ${hkLoading ? "animate-spin" : ""}`} /> Actualizar
            </button>
          </div>
          {hk.length > 0 && (
            <Card>
              <table className="min-w-full text-xs">
                <thead className="text-slate-500 border-b">
                  <tr>
                    <th className="py-2 pr-4 text-left">Hab.</th>
                    <th className="py-2 pr-4 text-left">Tipo</th>
                    <th className="py-2 pr-4 text-left">Estado</th>
                    <th className="py-2 pr-4 text-left">Huésped actual</th>
                    <th className="py-2 text-left">Sale hoy</th>
                  </tr>
                </thead>
                <tbody>
                  {hk.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-1.5 pr-4 font-bold">#{r.number}</td>
                      <td className="py-1.5 pr-4 text-slate-500">{r.type}</td>
                      <td className="py-1.5 pr-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${HK_COLORS[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status}</span>
                      </td>
                      <td className="py-1.5 pr-4">
                        {r.currentGuest ? `${r.currentGuest.guest?.firstName || ""} ${r.currentGuest.guest?.lastName || ""}`.trim() : "—"}
                      </td>
                      <td className="py-1.5">
                        {r.checkoutToday ? <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-medium">Sí</span> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {hk.length === 0 && !hkLoading && <p className="text-sm text-slate-400">Sin habitaciones.</p>}
        </div>
      )}
    </div>
  );
}
