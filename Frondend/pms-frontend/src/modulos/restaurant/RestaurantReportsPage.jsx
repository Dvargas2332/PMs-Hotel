import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, FilePlus2, Printer, Download } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { api } from "../../lib/api";
import RestaurantUserMenu from "./RestaurantUserMenu";

function formatMoney(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

export default function RestaurantReportsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [closes, setCloses] = useState([]);
  const [reports, setReports] = useState([]);
  const [creating, setCreating] = useState(false);
  const [printerCfg, setPrinterCfg] = useState({ cashierPrinter: "", kitchenPrinter: "", barPrinter: "" });
  const [printSettings, setPrintSettings] = useState({ paperType: "80mm" });
  const [historyGroup, setHistoryGroup] = useState("article");
  const [historyRows, setHistoryRows] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const tipTotal = useMemo(() => Number(stats?.tipTotal || 0), [stats?.tipTotal]);
  const paymentsByMethod = useMemo(() => stats?.byMethod || {}, [stats?.byMethod]);
  const closeDiff = useMemo(() => Number(stats?.closeDiff || 0), [stats?.closeDiff]);
  const ticketAvg = useMemo(() => Number(stats?.ticketAvg || 0), [stats?.ticketAvg]);
  const itemsPerTicket = useMemo(() => Number(stats?.itemsPerTicket || 0), [stats?.itemsPerTicket]);
  const itemsQtyTotal = useMemo(() => Number(stats?.itemsQtyTotal || 0), [stats?.itemsQtyTotal]);
  const salesByHour = useMemo(() => stats?.salesByHour || {}, [stats?.salesByHour]);

  const salesByHourRows = useMemo(
    () =>
      Object.entries(salesByHour || {})
        .map(([hour, amount]) => ({ hour, amount: Number(amount || 0) }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
    [salesByHour]
  );

  const historyChartRows = useMemo(() => {
    const list = Array.isArray(historyRows) ? historyRows.slice(0, 12) : [];
    const padLabel = (value) => String(value || "").slice(0, 16);
    if (historyGroup === "date") {
      return list
        .map((row) => ({ label: String(row.label || ""), total: Number(row.total || 0) }))
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((row) => ({ ...row, label: padLabel(row.label) }));
    }
    return list.map((row) => ({
      label: padLabel(row.label),
      total: Number(row.total || 0),
    }));
  }, [historyRows, historyGroup]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [reportRes, r, cfg] = await Promise.all([
        api.get("/restaurant/report", { params: { group: historyGroup, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } }),
        api.get("/reports?category=restaurant"),
        api.get("/restaurant/config"),
      ]);
      const reportData = reportRes?.data || {};
      setStats(reportData.stats || null);
      setCloses(Array.isArray(reportData.closes) ? reportData.closes : []);
      setHistoryRows(Array.isArray(reportData.history) ? reportData.history : []);
      setReports(Array.isArray(r?.data) ? r.data : []);
      const d = cfg?.data || {};
      setPrinterCfg({
        kitchenPrinter: d.kitchenPrinter || "",
        barPrinter: d.barPrinter || "",
        cashierPrinter: d.cashierPrinter || "",
      });
      const p = d.printing && typeof d.printing === "object" ? d.printing : null;
      if (p && p.paperType) setPrintSettings({ paperType: p.paperType });
    } catch (e) {
      setError("Could not load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyGroup]);

  const lastClose = useMemo(() => (closes || [])[0] || null, [closes]);

  const printSalesReport = async () => {
    try {
      const items = [
        { id: "system", itemId: "system", name: "System sales", category: "Report", qty: 1, price: Number(stats?.systemTotal || 0) },
        { id: "openOrders", itemId: "openOrders", name: "Open orders", category: "Report", qty: Number(stats?.openOrders || 0) || 0, price: 0 },
        { id: "openValue", itemId: "openValue", name: "Value on tables", category: "Report", qty: 1, price: Number(stats?.openOrderValue || 0) },
        { id: "tips", itemId: "tips", name: "Tips", category: "Report", qty: 1, price: tipTotal },
      ];
      Object.entries(paymentsByMethod || {}).forEach(([method, amount]) => {
        items.push({ id: `pay-${method}`, itemId: method, name: `Paid ${method}`, category: "Payments", qty: 1, price: Number(amount || 0) });
      });
      await api.post("/restaurant/print", {
        tableId: `SALES-REPORT-${Date.now()}`,
        items,
        note: lastClose?.createdAt ? `Last close: ${new Date(lastClose.createdAt).toLocaleString()}` : "",
        covers: 0,
        type: "SALES_REPORT",
        printers: { cashierPrinter: printerCfg.cashierPrinter, paperType: printSettings.paperType },
      });
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Sales report sent to printer" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Could not print report" } }));
    }
  };

  const downloadReportFile = async (format) => {
    try {
      const params = {
        format,
        group: historyGroup,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      const resp = await api.get("/restaurant/report/export", { params, responseType: "blob" });
      const blob = new Blob([resp.data], { type: resp.headers["content-type"] || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = format === "xlsx" ? "xlsx" : "csv";
      a.href = url;
      a.download = `restaurant-report-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "No se pudo exportar." } }));
    }
  };

  const createSnapshotReport = async () => {
    if (creating) return;
    setCreating(true);
      try {
        const payload = {
          title: `Restaurant - Snapshot ${new Date().toLocaleString()}`,
          category: "restaurant",
          type: "snapshot",
          filters: {},
          payload: {
            stats,
            lastClose,
            closes: (closes || []).slice(0, 20),
            paymentsByMethod,
            tipTotal,
            closeDiff,
          },
        };
        await api.post("/reports", payload);
        await refresh();
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Report created" } }));
      } catch {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Could not create report" } }));
      } finally {
        setCreating(false);
      }
    };

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white text-black">
      <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200 text-black shadow">
        <div className="flex items-center gap-2">
          <div>
            <div className="text-xs uppercase text-black/80">Reports</div>
            <div className="text-sm font-semibold">Restaurant</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs text-black">
            <div className="px-3 py-1 rounded-lg bg-white">Paper {printSettings.paperType || "80mm"}</div>
            <div className="px-3 py-1 rounded-lg bg-white">Printer {printerCfg.cashierPrinter || "-"}</div>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <input
              type="date"
              className="h-9 rounded-lg border px-2 text-xs bg-white"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="text-black/60">a</span>
            <input
              type="date"
              className="h-9 rounded-lg border px-2 text-xs bg-white"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <button
              className="h-9 px-3 rounded-lg bg-white hover:bg-lime-50 text-xs"
              onClick={refresh}
              title="Aplicar rango de fechas"
            >
              Filtrar
            </button>
            <button
              className="h-9 px-3 rounded-lg bg-white hover:bg-white text-xs"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                refresh();
              }}
              title="Limpiar filtros"
            >
              Limpiar
            </button>
          </div>
          <button className="h-9 px-3 rounded-lg bg-white hover:bg-white text-sm flex items-center gap-2" onClick={refresh}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            className="h-9 px-3 rounded-lg bg-white hover:bg-white text-sm flex items-center gap-2"
            onClick={printSalesReport}
            title="Print sales report"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            className="h-9 px-3 rounded-lg bg-white hover:bg-white text-sm flex items-center gap-2"
            onClick={() => {
              downloadReportFile("csv");
            }}
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="h-9 px-3 rounded-lg bg-white hover:bg-white text-sm flex items-center gap-2" onClick={() => downloadReportFile("xlsx")} title="Export XLSX">
            <Download className="w-4 h-4" />
            XLSX
          </button>
          <button
            className="h-9 px-3 rounded-lg bg-white hover:bg-lime-50 text-sm flex items-center gap-2 disabled:bg-white/40"
            onClick={createSnapshotReport}
            disabled={creating}
          >
            <FilePlus2 className="w-4 h-4" />
            {creating ? "Creating..." : "Create snapshot"}
          </button>
          <RestaurantUserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {error && <div className="text-sm text-red-300">{error}</div>}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-xs text-black">System sales</div>
            <div className="text-2xl font-bold">{formatMoney(stats?.systemTotal)}</div>
          </div>
            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <div className="text-xs text-black">Open orders</div>
              <div className="text-2xl font-bold">{stats?.openOrders ?? 0}</div>
            </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-xs text-black">Value on tables</div>
            <div className="text-2xl font-bold">{formatMoney(stats?.openOrderValue)}</div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-xs text-black">Last close</div>
            <div className="text-sm font-semibold">{stats?.lastCloseAt ? new Date(stats.lastCloseAt).toLocaleString() : "-"}</div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-xs text-black">Tips</div>
            <div className="text-2xl font-bold">{formatMoney(tipTotal)}</div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-xs text-black">Ticket promedio</div>
            <div className="text-2xl font-bold">{formatMoney(ticketAvg)}</div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-xs text-black">Items por ticket</div>
            <div className="text-2xl font-bold">{itemsPerTicket.toFixed(2)}</div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-xs text-black">Items vendidos</div>
            <div className="text-2xl font-bold">{itemsQtyTotal.toFixed(0)}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4 space-y-3">
          <div className="text-lg font-semibold">Payments by method</div>
          <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.keys(paymentsByMethod || {}).length === 0 && <div className="text-sm text-black">No payments yet.</div>}
            {Object.entries(paymentsByMethod || {}).map(([method, amount]) => (
              <div key={method} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                <div className="text-xs uppercase text-black">{method}</div>
                <div className="text-base font-semibold text-black">{formatMoney(amount)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4 space-y-3">
          <div className="text-lg font-semibold">Ventas por hora</div>
          {Object.keys(salesByHour || {}).length === 0 ? (
            <div className="text-sm text-black">No hay ventas por hora en el rango.</div>
          ) : (
            <div className="grid md:grid-cols-[2fr,1fr] gap-4">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByHourRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip formatter={(v) => formatMoney(v)} />
                    <Bar dataKey="amount" fill="#65a30d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-2">
                {salesByHourRows.map((r) => (
                  <div key={r.hour} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                    <div className="text-xs uppercase text-black">{r.hour}</div>
                    <div className="text-base font-semibold text-black">{formatMoney(r.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4 space-y-3">
          <div className="text-lg font-semibold">
            {historyGroup === "date" ? "Ventas por día" : "Tendencia (Top grupos)"}
          </div>
          {historyChartRows.length === 0 ? (
            <div className="text-sm text-black">No hay datos para graficar.</div>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyChartRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Históricos</div>
              <div className="text-xs text-black/70">Estadísticas por artículo, fecha, cierre y familias.</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="text-xs text-black/70">Agrupar por</label>
              <select
                className="h-9 rounded-lg border px-3 text-sm bg-white"
                value={historyGroup}
                onChange={(e) => setHistoryGroup(e.target.value)}
              >
                <option value="article">Venta de artículo</option>
                <option value="product">Producto</option>
                <option value="date">Fecha</option>
                <option value="close">Cierre</option>
                <option value="family">Familia</option>
                <option value="subFamily">Subfamilia</option>
                <option value="subSubFamily">Sub Subfamilia</option>
                <option value="cashier">Cajero</option>
                <option value="waiter">Mesero</option>
              </select>
            </div>
          </div>

          {historyRows.length === 0 ? (
            <div className="text-sm text-black">No hay ventas registradas.</div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-black/60 border-b">
                    <th className="py-2 pr-2">Grupo</th>
                    <th className="py-2 pr-2 text-right">Cantidad</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr key={row.label} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">{row.label}</td>
                      <td className="py-2 pr-2 text-right">{row.qty}</td>
                      <td className="py-2 text-right">{formatMoney(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className="text-lg font-semibold">Saved reports</div>
          <div className="text-xs text-black mb-3">Stored under `/reports` with category `restaurant`.</div>
          {(reports || []).length === 0 && <div className="text-sm text-black">No reports yet.</div>}
          {(reports || []).length > 0 && (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-black/10 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{r.title || r.id}</div>
                    <div className="text-xs text-black">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</div>
                  </div>
                  <div className="text-xs text-black">Type: {r.type || "-"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
