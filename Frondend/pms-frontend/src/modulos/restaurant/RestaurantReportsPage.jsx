import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, RefreshCw, FilePlus2, Printer, Download } from "lucide-react";
import { api } from "../../lib/api";
import RestaurantUserMenu from "./RestaurantUserMenu";

function formatMoney(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

export default function RestaurantReportsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [closes, setCloses] = useState([]);
  const [reports, setReports] = useState([]);
  const [creating, setCreating] = useState(false);
  const [printerCfg, setPrinterCfg] = useState({ cashierPrinter: "", kitchenPrinter: "", barPrinter: "" });
  const [printSettings, setPrintSettings] = useState({ paperType: "80mm" });
  const [paidOrders, setPaidOrders] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);
  const [historyGroup, setHistoryGroup] = useState("article");

  const tipTotal = useMemo(() => Number(stats?.tipTotal || 0), [stats?.tipTotal]);
  const paymentsByMethod = useMemo(() => stats?.byMethod || {}, [stats?.byMethod]);
  const closeDiff = useMemo(() => Number((stats?.reportedTotal || 0) - (stats?.systemTotal || 0)), [stats?.reportedTotal, stats?.systemTotal]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, c, r, cfg] = await Promise.all([
        api.get("/restaurant/stats"),
        api.get("/restaurant/close"),
        api.get("/reports?category=restaurant"),
        api.get("/restaurant/config"),
      ]);
      const sdata = s?.data || null;
      setStats(sdata);
      setCloses(Array.isArray(c?.data) ? c.data : []);
      setReports(Array.isArray(r?.data) ? r.data : []);
      const d = cfg?.data || {};
      setPrinterCfg({
        kitchenPrinter: d.kitchenPrinter || "",
        barPrinter: d.barPrinter || "",
        cashierPrinter: d.cashierPrinter || "",
      });
      const p = d.printing && typeof d.printing === "object" ? d.printing : null;
      if (p && p.paperType) setPrintSettings({ paperType: p.paperType });

      const [paid, items] = await Promise.all([
        api.get("/restaurant/orders?status=PAID"),
        api.get("/restaurant/items"),
      ]);
      setPaidOrders(Array.isArray(paid?.data) ? paid.data : []);
      setItemsCatalog(Array.isArray(items?.data) ? items.data : []);
    } catch (e) {
      setError("Could not load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastClose = useMemo(() => (closes || [])[0] || null, [closes]);

  const itemById = useMemo(() => {
    const map = new Map();
    (itemsCatalog || []).forEach((i) => {
      map.set(String(i.id), i);
    });
    return map;
  }, [itemsCatalog]);

  const closesSorted = useMemo(() => {
    return (closes || [])
      .map((c) => ({ ...c, createdAt: c.createdAt ? new Date(c.createdAt) : null }))
      .filter((c) => c.createdAt)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [closes]);

  const resolveCloseKey = useCallback(
    (orderTime) => {
      if (!orderTime) return "Sin cierre";
      const dt = new Date(orderTime);
      const match = closesSorted.find((c) => c.createdAt >= dt);
      if (!match) return "Sin cierre";
      const label = `${match.turno ? `Turno ${match.turno} - ` : ""}${match.createdAt.toLocaleString()}`;
      return `Cierre ${label}`;
    },
    [closesSorted]
  );

  const historyRows = useMemo(() => {
    if (!Array.isArray(paidOrders) || paidOrders.length === 0) return [];

    const rows = new Map();
    const addRow = (key, label, qty, total) => {
      const prev = rows.get(key) || { label, qty: 0, total: 0 };
      prev.qty += qty;
      prev.total += total;
      rows.set(key, prev);
    };

    paidOrders.forEach((order) => {
      const items = Array.isArray(order?.items) ? order.items : [];
      const orderTime = order?.updatedAt || order?.createdAt;
      const orderDateKey = orderTime ? new Date(orderTime).toISOString().slice(0, 10) : "Sin fecha";
      const orderTotal = Number(order?.total || 0) || items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 0), 0);

      if (historyGroup === "date") {
        addRow(orderDateKey, orderDateKey, 1, orderTotal);
        return;
      }

      if (historyGroup === "close") {
        const closeKey = resolveCloseKey(orderTime);
        addRow(closeKey, closeKey, 1, orderTotal);
        return;
      }

      if (historyGroup === "cashier") {
        addRow("Cajero (por implementar)", "Cajero (por implementar)", 1, orderTotal);
        return;
      }

      if (historyGroup === "waiter") {
        const waiterId = order?.waiterId ? String(order.waiterId) : "Sin mesero";
        addRow(waiterId, waiterId, 1, orderTotal);
        return;
      }

      items.forEach((item) => {
        const qty = Number(item?.qty || 0);
        const total = Number(item?.price || 0) * qty;
        const catalog = itemById.get(String(item?.itemId || item?.id || ""));
        const family = catalog?.family || "Sin familia";
        const subFamily = catalog?.subFamily || "Sin subfamilia";
        const subSubFamily = catalog?.subSubFamily || "Sin subsubfamilia";
        const code = catalog?.code ? String(catalog.code) : String(item?.itemId || "");
        const name = String(item?.name || catalog?.name || "Producto");

        if (historyGroup === "family") {
          addRow(family, family, qty, total);
        } else if (historyGroup === "subFamily") {
          addRow(subFamily, subFamily, qty, total);
        } else if (historyGroup === "subSubFamily") {
          addRow(subSubFamily, subSubFamily, qty, total);
        } else if (historyGroup === "product") {
          addRow(name, name, qty, total);
        } else {
          const label = code ? `${code} - ${name}` : name;
          addRow(label, label, qty, total);
        }
      });
    });

    return Array.from(rows.values()).sort((a, b) => b.total - a.total);
  }, [paidOrders, historyGroup, itemById, resolveCloseKey]);

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
          <button
            className="h-9 px-3 rounded-lg bg-white hover:bg-white flex items-center gap-2 text-sm"
            onClick={() => navigate("/restaurant")}
          >
            <ChevronLeft className="w-4 h-4" />
            Lobby
          </button>
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
              const rows = [
                ["System sales", stats?.systemTotal ?? 0],
                ["Reported total", stats?.reportedTotal ?? 0],
                ["Diff (reported - system)", closeDiff],
                ["Open orders", stats?.openOrders ?? 0],
                ["Value on tables", stats?.openOrderValue ?? 0],
                ["Tips", tipTotal],
                ["Last close", stats?.lastCloseAt || ""],
              ];
              Object.entries(paymentsByMethod || {}).forEach(([method, amount]) =>
                rows.push([`Paid ${method}`, amount])
              );
              const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `restaurant-report-${Date.now()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
            Export
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
                <option value="cashier">Cajero (por implementar)</option>
                <option value="waiter">Mesero (por implementar)</option>
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




