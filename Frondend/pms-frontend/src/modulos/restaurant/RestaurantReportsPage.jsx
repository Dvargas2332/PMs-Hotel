import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, RefreshCw, FilePlus2, Printer } from "lucide-react";
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
      setStats(s?.data || null);
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

  const printSalesReport = async () => {
    try {
      const items = [
        { id: "system", itemId: "system", name: "System sales", category: "Report", qty: 1, price: Number(stats?.systemTotal || 0) },
        { id: "openOrders", itemId: "openOrders", name: "Open orders", category: "Report", qty: Number(stats?.openOrders || 0) || 0, price: 0 },
        { id: "openValue", itemId: "openValue", name: "Value on tables", category: "Report", qty: 1, price: Number(stats?.openOrderValue || 0) },
      ];
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white">
      <header className="h-14 flex items-center justify-between px-6 bg-gradient-to-r from-amber-700 to-slate-800 shadow">
        <div className="flex items-center gap-2">
          <button
            className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm"
            onClick={() => navigate("/restaurant")}
          >
            <ChevronLeft className="w-4 h-4" />
            Lobby
          </button>
          <div>
            <div className="text-xs uppercase text-amber-200/80">Reports</div>
            <div className="text-sm font-semibold">Restaurant</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs text-amber-100/80">
            <div className="px-3 py-1 rounded-lg bg-white/10">Paper {printSettings.paperType || "80mm"}</div>
            <div className="px-3 py-1 rounded-lg bg-white/10">Printer {printerCfg.cashierPrinter || "-"}</div>
          </div>
          <button className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-sm flex items-center gap-2" onClick={refresh}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-sm flex items-center gap-2"
            onClick={printSalesReport}
            title="Print sales report"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm flex items-center gap-2 disabled:bg-emerald-600/40"
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
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-amber-100/70">System sales</div>
            <div className="text-2xl font-bold">{formatMoney(stats?.systemTotal)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-amber-100/70">Open orders</div>
            <div className="text-2xl font-bold">{stats?.openOrders ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-amber-100/70">Value on tables</div>
            <div className="text-2xl font-bold">{formatMoney(stats?.openOrderValue)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-amber-100/70">Last close</div>
            <div className="text-sm font-semibold">{stats?.lastCloseAt ? new Date(stats.lastCloseAt).toLocaleString() : "-"}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-lg font-semibold">Saved reports</div>
          <div className="text-xs text-amber-100/70 mb-3">Stored under `/reports` with category `restaurant`.</div>
          {(reports || []).length === 0 && <div className="text-sm text-amber-100/70">No reports yet.</div>}
          {(reports || []).length > 0 && (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{r.title || r.id}</div>
                    <div className="text-xs text-amber-100/60">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</div>
                  </div>
                  <div className="text-xs text-amber-100/70">Type: {r.type || "-"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
