import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, RefreshCw, CheckCircle2, Printer } from "lucide-react";
import { api } from "../../lib/api";
import RestaurantUserMenu from "./RestaurantUserMenu";

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n) {
  return `$${asNumber(n).toFixed(2)}`;
}

export default function RestaurantClosesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [closes, setCloses] = useState([]);
  const [form, setForm] = useState({ cash: "", card: "", sinpe: "", transfer: "", room: "", notes: "" });
  const [printerCfg, setPrinterCfg] = useState({ cashierPrinter: "", kitchenPrinter: "", barPrinter: "" });
  const [printSettings, setPrintSettings] = useState({ paperType: "80mm" });

  const closeSummary = useMemo(() => {
    const cash = asNumber(form.cash);
    const card = asNumber(form.card);
    const sinpe = asNumber(form.sinpe);
    const transfer = asNumber(form.transfer);
    const room = asNumber(form.room);
    const reported = cash + card + sinpe + transfer + room;
    const system = asNumber(stats?.systemTotal);
    return { system, reported, diff: reported - system };
  }, [form, stats]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, c, cfg] = await Promise.all([api.get("/restaurant/stats"), api.get("/restaurant/close"), api.get("/restaurant/config")]);
      setStats(s?.data || null);
      setCloses(Array.isArray(c?.data) ? c.data : []);
      const d = cfg?.data || {};
      setPrinterCfg({
        kitchenPrinter: d.kitchenPrinter || "",
        barPrinter: d.barPrinter || "",
        cashierPrinter: d.cashierPrinter || "",
      });
      const p = d.printing && typeof d.printing === "object" ? d.printing : null;
      if (p && p.paperType) setPrintSettings({ paperType: p.paperType });
    } catch {
      setError("Could not load closes.");
    } finally {
      setLoading(false);
    }
  };

  const printClose = async (c) => {
    if (!c?.id) return;
    try {
      const items = [
        { id: "system", itemId: "system", name: "System", category: "Close", qty: 1, price: asNumber(c?.totals?.system) },
        { id: "reported", itemId: "reported", name: "Reported", category: "Close", qty: 1, price: asNumber(c?.totals?.reported) },
        { id: "diff", itemId: "diff", name: "Difference", category: "Close", qty: 1, price: asNumber(c?.totals?.diff) },
      ];
      await api.post("/restaurant/print", {
        tableId: `CLOSE-${c.id}`,
        items,
        note: c.note || "",
        covers: 0,
        type: "CLOSES",
        printers: { cashierPrinter: printerCfg.cashierPrinter, paperType: printSettings.paperType },
      });
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Close sent to printer" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Could not print close" } }));
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitClose = async () => {
    if (closing) return;
    setClosing(true);
    setError("");
    try {
      await api.post("/restaurant/close", {
        totals: closeSummary,
        payments: form,
        note: form.notes,
        breakdown: stats?.byMethod || {},
      });
      setForm({ cash: "", card: "", sinpe: "", transfer: "", room: "", notes: "" });
      await refresh();
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Close recorded" } })
      );
    } catch {
      setError("Could not record close.");
    } finally {
      setClosing(false);
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
            <div className="text-xs uppercase text-amber-200/80">Closes</div>
            <div className="text-sm font-semibold">Restaurant</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs text-amber-100/80">
            <div className="px-3 py-1 rounded-lg bg-white/10">Paper {printSettings.paperType || "80mm"}</div>
            <div className="px-3 py-1 rounded-lg bg-white/10">Printer {printerCfg.cashierPrinter || "-"}</div>
          </div>
          <button
            className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-sm flex items-center gap-2"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <RestaurantUserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {error && <div className="text-sm text-red-300">{error}</div>}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-amber-100/70">System sales (since last close)</div>
            <div className="text-2xl font-bold">{formatMoney(stats?.systemTotal)}</div>
            <div className="text-xs text-amber-100/60">Paid sales</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-amber-100/70">Open orders</div>
            <div className="text-2xl font-bold">{stats?.openOrders ?? 0}</div>
            <div className="text-xs text-amber-100/60">Value: {formatMoney(stats?.openOrderValue)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-amber-100/70">Last close</div>
            <div className="text-sm font-semibold">{stats?.lastCloseAt ? new Date(stats.lastCloseAt).toLocaleString() : "-"}</div>
            <div className="text-xs text-amber-100/60">Listed closes: {(closes || []).length}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-lg font-semibold">Record close</div>
            <div className="text-xs text-amber-100/70 mb-3">
              Enter the counted amounts by method. The system computes the actual total from paid sales.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 text-sm text-white placeholder:text-amber-100/40"
                placeholder="Cash"
                type="number"
                value={form.cash}
                onChange={(e) => setForm((f) => ({ ...f, cash: e.target.value }))} 
              />
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 text-sm text-white placeholder:text-amber-100/40"
                placeholder="Card"
                type="number"
                value={form.card}
                onChange={(e) => setForm((f) => ({ ...f, card: e.target.value }))} 
              />
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 text-sm text-white placeholder:text-amber-100/40"
                placeholder="SINPE"
                type="number"
                value={form.sinpe}
                onChange={(e) => setForm((f) => ({ ...f, sinpe: e.target.value }))}
              />
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 text-sm text-white placeholder:text-amber-100/40"
                placeholder="Transfer"
                type="number"
                value={form.transfer}
                onChange={(e) => setForm((f) => ({ ...f, transfer: e.target.value }))}
              />
              <input
                className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 text-sm text-white placeholder:text-amber-100/40"
                placeholder="Room charge"
                type="number"
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
              />
            </div>

            <textarea
              className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm text-white placeholder:text-amber-100/40 min-h-[90px]"
              placeholder="Close notes..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />

            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-amber-100/70">System</div>
                <div className="font-semibold">{formatMoney(closeSummary.system)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-amber-100/70">Reported</div>
                <div className="font-semibold">{formatMoney(closeSummary.reported)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-amber-100/70">Difference</div>
                <div className={`font-semibold ${closeSummary.diff === 0 ? "text-emerald-200" : "text-amber-200"}`}>
                  {formatMoney(closeSummary.diff)}
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold flex items-center gap-2 disabled:bg-amber-600/40"
                onClick={submitClose}
                disabled={closing}
              >
                <CheckCircle2 className="w-4 h-4" />
                {closing ? "Sending..." : "Record close"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-lg font-semibold">Recent closes</div>
            <div className="text-xs text-amber-100/70 mb-3">Last 200 (sorted by date).</div>
            {(closes || []).length === 0 && !loading && (
              <div className="text-sm text-amber-100/70">No closes.</div>
            )}
            {(closes || []).length > 0 && (
              <div className="space-y-2 max-h-[62vh] overflow-y-auto">
                {closes.map((c) => (
                  <div key={c.id} className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{c.turno || c.shift || c.id}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-amber-100/60">
                          {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                        </div>
                        <button
                          className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-sm flex items-center gap-2"
                          onClick={() => printClose(c)}
                          title="Print close"
                        >
                          <Printer className="w-4 h-4" />
                          Print
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-amber-100/70">
                      System: {formatMoney(c.totals?.system)} | Reported: {formatMoney(c.totals?.reported)} | Diff:{" "}
                      {formatMoney(c.totals?.diff)}
                    </div>
                    <div className="mt-1 text-xs text-amber-100/70">
                      Payments: cash {formatMoney(c.payments?.cash)}, card {formatMoney(c.payments?.card)}, sinpe{" "}
                      {formatMoney(c.payments?.sinpe)}, transfer {formatMoney(c.payments?.transfer)}, room{" "}
                      {formatMoney(c.payments?.room)}
                    </div>
                    {c.note && <div className="mt-1 text-xs text-amber-100/60">Note: {c.note}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
