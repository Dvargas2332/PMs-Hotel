import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, CheckCircle2, Printer } from "lucide-react";
import { api } from "../../lib/api";
import RestaurantUserMenu from "./RestaurantUserMenu";
import { useAuth } from "../../context/AuthContext";
import { normalizeMoneyInput } from "../../lib/money";

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n) {
  return `$${asNumber(n).toFixed(2)}`;
}

export default function RestaurantClosesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [closes, setCloses] = useState([]);
  const [form, setForm] = useState({ cash: "", card: "", sinpe: "", transfer: "", room: "", notes: "" });
  const [closeType, setCloseType] = useState("X");
  const [printerCfg, setPrinterCfg] = useState({ cashierPrinter: "", kitchenPrinter: "", barPrinter: "" });
  const [printSettings, setPrintSettings] = useState({ paperType: "80mm" });

  const closeSummary = useMemo(() => {
    const cash = asNumber(form.cash);
    const card = asNumber(form.card);
    const sinpe = asNumber(form.sinpe);
    const transfer = asNumber(form.transfer);
    const room = asNumber(form.room);
    const tips = asNumber(stats?.tipTotal);
    const reported = cash + card + sinpe + transfer + room;
    const system = asNumber(stats?.systemTotal);
    return { system, reported, diff: reported - system, tips };
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
        { id: "tips", itemId: "tips", name: "Tips", category: "Close", qty: 1, price: asNumber(c?.totals?.tips) },
        { id: "diff", itemId: "diff", name: "Difference", category: "Close", qty: 1, price: asNumber(c?.totals?.diff) },
      ];
      Object.entries(c?.breakdown || {}).forEach(([method, amount]) => {
        items.push({ id: `m-${method}`, itemId: method, name: `Paid ${method}`, category: "Payments", qty: 1, price: asNumber(amount) });
      });
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

  const canCloseZ = useMemo(() => {
    const perms = Array.isArray(user?.permissions) ? user.permissions : [];
    const role = String(user?.role || "").toUpperCase();
    return role === "ADMIN" || perms.includes("restaurant.shift.closeZ");
  }, [user?.permissions, user?.role]);

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
        tipTotal: asNumber(stats?.tipTotal),
        type: closeType,
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
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white text-black">
      <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200 text-black shadow">
        <div className="flex items-center gap-2">
          <div>
            <div className="text-xs uppercase text-black/80">Closes</div>
            <div className="text-sm font-semibold">Restaurant</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs text-black">
            <div className="px-3 py-1 rounded-lg bg-white">Paper {printSettings.paperType || "80mm"}</div>
            <div className="px-3 py-1 rounded-lg bg-white">Printer {printerCfg.cashierPrinter || "-"}</div>
          </div>
          <button
            className="h-9 px-3 rounded-lg bg-white hover:bg-white text-sm flex items-center gap-2"
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-black">System sales (since last close)</div>
            <div className="text-2xl font-bold">{formatMoney(stats?.systemTotal)}</div>
            <div className="text-xs text-black">Paid sales</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-black">Open orders</div>
            <div className="text-2xl font-bold">{stats?.openOrders ?? 0}</div>
            <div className="text-xs text-black">Value: {formatMoney(stats?.openOrderValue)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-black">Last close</div>
            <div className="text-sm font-semibold">{stats?.lastCloseAt ? new Date(stats.lastCloseAt).toLocaleString() : "-"}</div>
            <div className="text-xs text-black">Listed closes: {(closes || []).length}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-lg font-semibold">Record close</div>
            <div className="text-xs text-black mb-3">
              Enter the counted amounts by method. The system computes the actual total from paid sales.
            </div>
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-[11px] uppercase text-slate-500 mb-2">Cobros TPV</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-black">
                <div className="flex items-center justify-between gap-2">
                  <span>Efectivo</span>
                  <span className="font-semibold">{formatMoney(stats?.byMethod?.cash)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Tarjeta</span>
                  <span className="font-semibold">{formatMoney(stats?.byMethod?.card)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>SINPE</span>
                  <span className="font-semibold">{formatMoney(stats?.byMethod?.sinpe)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Transferencia</span>
                  <span className="font-semibold">{formatMoney(stats?.byMethod?.transfer)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Room charge</span>
                  <span className="font-semibold">{formatMoney(stats?.byMethod?.room)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Total TPV</span>
                  <span className="font-semibold">{formatMoney(stats?.systemTotal)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <button
                className={`px-3 py-2 rounded-lg border text-sm ${closeType === "X" ? "bg-emerald-100 border-emerald-300" : "bg-white"}`}
                onClick={() => setCloseType("X")}
              >
                Cierre X (parcial)
              </button>
              <button
                className={`px-3 py-2 rounded-lg border text-sm ${closeType === "Z" ? "bg-emerald-100 border-emerald-300" : "bg-white"}`}
                onClick={() => canCloseZ && setCloseType("Z")}
                disabled={!canCloseZ}
                title={canCloseZ ? "" : "No tienes permiso para cierre Z"}
              >
                Cierre Z (final)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-black placeholder:text-black"
                placeholder="Cash"
                type="text"
                inputMode="decimal"
                pattern="[0-9.,-]*"
                value={form.cash}
                onChange={(e) => setForm((f) => ({ ...f, cash: e.target.value }))} 
                onBlur={(e) => setForm((f) => ({ ...f, cash: normalizeMoneyInput(e.target.value) }))}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-black placeholder:text-black"
                placeholder="Card"
                type="text"
                inputMode="decimal"
                pattern="[0-9.,-]*"
                value={form.card}
                onChange={(e) => setForm((f) => ({ ...f, card: e.target.value }))} 
                onBlur={(e) => setForm((f) => ({ ...f, card: normalizeMoneyInput(e.target.value) }))}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-black placeholder:text-black"
                placeholder="SINPE"
                type="text"
                inputMode="decimal"
                pattern="[0-9.,-]*"
                value={form.sinpe}
                onChange={(e) => setForm((f) => ({ ...f, sinpe: e.target.value }))}
                onBlur={(e) => setForm((f) => ({ ...f, sinpe: normalizeMoneyInput(e.target.value) }))}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-black placeholder:text-black"
                placeholder="Transfer"
                type="text"
                inputMode="decimal"
                pattern="[0-9.,-]*"
                value={form.transfer}
                onChange={(e) => setForm((f) => ({ ...f, transfer: e.target.value }))}
                onBlur={(e) => setForm((f) => ({ ...f, transfer: normalizeMoneyInput(e.target.value) }))}
              />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-black placeholder:text-black"
                placeholder="Room charge"
                type="text"
                inputMode="decimal"
                pattern="[0-9.,-]*"
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                onBlur={(e) => setForm((f) => ({ ...f, room: normalizeMoneyInput(e.target.value) }))}
              />
            </div>

            <textarea
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-black placeholder:text-black min-h-[90px]"
              placeholder="Close notes..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />

            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-black">System</div>
                <div className="font-semibold">{formatMoney(closeSummary.system)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-black">Reported</div>
                <div className="font-semibold">{formatMoney(closeSummary.reported)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-black">Difference</div>
                <div className={`font-semibold ${closeSummary.diff === 0 ? "text-black" : "text-black"}`}>
                  {formatMoney(closeSummary.diff)}
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                className="h-10 px-4 rounded-xl bg-lime-200 hover:bg-lime-300 text-black text-sm font-semibold flex items-center gap-2 disabled:bg-lime-200/40"
                onClick={submitClose}
                disabled={closing}
              >
                <CheckCircle2 className="w-4 h-4" />
                {closing ? "Sending..." : "Record close"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-lg font-semibold">Recent closes</div>
            <div className="text-xs text-black mb-3">Last 200 (sorted by date).</div>
            {(closes || []).length === 0 && !loading && (
              <div className="text-sm text-black">No closes.</div>
            )}
            {(closes || []).length > 0 && (
              <div className="space-y-2 max-h-[62vh] overflow-y-auto">
                {closes.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{c.turno || c.shift || c.id}</div>
                        <div className="text-xs text-black">Tipo: {c.type || "X"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-black">
                          {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                        </div>
                        <button
                          className="h-8 px-3 rounded-lg bg-white hover:bg-white text-sm flex items-center gap-2"
                          onClick={() => printClose(c)}
                          title="Print close"
                        >
                          <Printer className="w-4 h-4" />
                          Print
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-black">
                      System: {formatMoney(c.totals?.system)} | Reported: {formatMoney(c.totals?.reported)} | Diff:{" "}
                      {formatMoney(c.totals?.diff)}
                    </div>
                    <div className="mt-1 text-xs text-black">
                      Payments: cash {formatMoney(c.payments?.cash)}, card {formatMoney(c.payments?.card)}, sinpe{" "}
                      {formatMoney(c.payments?.sinpe)}, transfer {formatMoney(c.payments?.transfer)}, room{" "}
                      {formatMoney(c.payments?.room)}
                    </div>
                    {c.note && <div className="mt-1 text-xs text-black">Note: {c.note}</div>}
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


