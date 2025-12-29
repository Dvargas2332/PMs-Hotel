import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, RefreshCw, Printer } from "lucide-react";
import { api } from "../../lib/api";
import RestaurantUserMenu from "./RestaurantUserMenu";
import RestaurantCloseXButton from "./RestaurantCloseXButton";

function asNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n) {
  return `$${asNumber(n).toFixed(2)}`;
}

function normalizeItemsForPrint(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((it) => ({
    id: it.itemId || it.id,
    itemId: it.itemId,
    name: it.name,
    category: it.category,
    qty: asNumber(it.qty) || 1,
    price: asNumber(it.price),
    area: it.area,
  }));
}

export default function RestaurantBillingHistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [actingId, setActingId] = useState("");
  const [printerCfg, setPrinterCfg] = useState({ kitchenPrinter: "", barPrinter: "", cashierPrinter: "" });
  const [printSettings, setPrintSettings] = useState({ paperType: "80mm" });

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueOrder, setIssueOrder] = useState(null);
  const [issueType, setIssueType] = useState("TE"); // TE | FE
  const [issueReceiver, setIssueReceiver] = useState({ name: "", email: "" });
  const [issuing, setIssuing] = useState(false);
  const [docsByOrder, setDocsByOrder] = useState({});

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      try {
        const cfg = await api.get("/restaurant/config");
        const d = cfg?.data || {};
        setPrinterCfg({
          kitchenPrinter: d.kitchenPrinter || "",
          barPrinter: d.barPrinter || "",
          cashierPrinter: d.cashierPrinter || "",
        });
        const p = d.printing && typeof d.printing === "object" ? d.printing : null;
        if (p && p.paperType) setPrintSettings({ paperType: p.paperType });
      } catch {
        // ignore
      }
      const { data } = await api.get("/restaurant/orders?status=PAID");
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load billing history.");
    } finally {
      setLoading(false);
    }
  };

  const refreshDocsForOrder = async (orderId) => {
    if (!orderId) return;
    try {
      const { data } = await api.get(`/einvoicing/documents?restaurantOrderId=${encodeURIComponent(orderId)}`);
      const list = Array.isArray(data) ? data : [];
      setDocsByOrder((prev) => ({ ...prev, [orderId]: list }));
    } catch {
      setDocsByOrder((prev) => ({ ...prev, [orderId]: [] }));
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (orders || []).slice(0, 25).forEach((o) => refreshDocsForOrder(o.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return orders || [];
    return (orders || []).filter((o) => {
      const text = [
        o.id,
        o.tableId,
        o.sectionId,
        o.serviceType,
        o.roomId,
        o.note,
        (o.items || []).map((i) => i.name).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [orders, query]);

  const logBillingEvent = async (action, order, meta) => {
    try {
      await api.post("/reports", {
        title: `Restaurant - ${action} - ${new Date().toLocaleString()}`,
        category: "restaurant",
        type: "billing_event",
        filters: {},
        payload: { action, orderId: order?.id, tableId: order?.tableId, sectionId: order?.sectionId, meta: meta || {} },
      });
    } catch {
      // Do not block if reports module is unavailable
    }
  };

  const reprint = async (order) => {
    if (!order?.tableId) return;
    setActingId(order.id);
    try {
      const payload = {
        sectionId: order.sectionId,
        tableId: order.tableId,
        items: normalizeItemsForPrint(order.items),
        note: order.note || "",
        covers: order.covers || 0,
        type: "DOCUMENT",
        printers: { cashierPrinter: printerCfg.cashierPrinter, paperType: printSettings.paperType },
      };
      await api.post("/restaurant/print", payload);
      await logBillingEvent("reprint", order, {});
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Billing", desc: "Reprint sent" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Billing", desc: "Could not reprint" } }));
    } finally {
      setActingId("");
    }
  };

  const openIssue = (order, type) => {
    setIssueOrder(order || null);
    setIssueType(type || "TE");
    setIssueReceiver({ name: "", email: "" });
    setIssueOpen(true);
  };

  const doIssue = async () => {
    if (!issueOrder?.id) return;
    setIssuing(true);
    try {
      const receiver = issueType === "FE" ? issueReceiver : null;
      const { data } = await api.post("/einvoicing/restaurant/issue", {
        restaurantOrderId: issueOrder.id,
        docType: issueType,
        receiver,
      });
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Electronic invoicing", desc: `${issueType} created with status ${data?.status || "DRAFT"}.` },
        })
      );
      setIssueOpen(false);
      await refreshDocsForOrder(issueOrder.id);
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not issue electronic document.";
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Electronic invoicing", desc: msg } }));
    } finally {
      setIssuing(false);
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
            <div className="text-xs uppercase text-amber-200/80">Billing</div>
            <div className="text-sm font-semibold">History</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs">
            <div className="px-3 py-1 rounded-lg bg-white/10">Paper {printSettings.paperType || "80mm"}</div>
            <div className="px-3 py-1 rounded-lg bg-white/10">Printer {printerCfg.cashierPrinter || "-"}</div>
          </div>
          <button
            className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-sm flex items-center gap-2"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Refresh"}
          </button>
          <RestaurantUserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {error && <div className="text-sm text-red-300">{error}</div>}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-semibold">Paid orders</div>
              <div className="text-xs text-amber-100/70">History for paid orders, reprints, and electronic documents.</div>
            </div>
            <input
              className="h-10 w-full md:w-[360px] rounded-xl border border-white/10 bg-slate-950/30 px-3 text-sm text-white placeholder:text-amber-100/40"
              placeholder="Search by table, note, room, item..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {(filtered || []).length === 0 && !loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-amber-100/70">
            No paid orders to show.
          </div>
        )}

        {(filtered || []).length > 0 && (
          <div className="space-y-2">
            {filtered.map((o) => (
              <div key={o.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase text-amber-200/70">
                      {o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}
                    </div>
                    <div className="text-lg font-semibold">
                      {o.sectionId ? `${o.sectionId} / ` : ""}
                      {o.tableId ? `Table ${o.tableId}` : `Order ${String(o.id || "").slice(0, 8)}`}
                    </div>
                    <div className="text-xs text-amber-100/70">
                      Total: <span className="font-semibold">{formatMoney(o.total)}</span>
                      {o.serviceType ? ` · ${o.serviceType}` : ""}
                      {o.roomId ? ` · Room ${o.roomId}` : ""}
                    </div>
                    {o.note && <div className="text-xs text-amber-100/60 mt-1">Note: {o.note}</div>}
                    {(o.items || []).length > 0 && (
                      <div className="mt-2 text-xs text-amber-100/70">
                        {(o.items || [])
                          .slice(0, 6)
                          .map((it) => `${asNumber(it.qty) || 1}x ${it.name}`)
                          .join(" | ")}
                        {(o.items || []).length > 6 ? " | ..." : ""}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      className="h-9 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:bg-violet-600/40"
                      onClick={() => openIssue(o, "TE")}
                      title="Issue Electronic Ticket (TE)"
                    >
                      TE
                    </button>
                    <button
                      className="h-9 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:bg-indigo-600/40"
                      onClick={() => openIssue(o, "FE")}
                      title="Issue Electronic Invoice (FE)"
                    >
                      FE
                    </button>
                    <button
                      className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 disabled:bg-emerald-600/40"
                      onClick={() => reprint(o)}
                      disabled={actingId === o.id}
                      title="Reprint"
                    >
                      <Printer className="w-4 h-4" />
                      {actingId === o.id ? "Sending..." : "Reprint"}
                    </button>
                  </div>
                </div>

                {(docsByOrder[o.id] || []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {(docsByOrder[o.id] || []).map((d) => (
                      <span key={d.id} className="px-2 py-1 rounded-lg bg-white/10 border border-white/10">
                        {d.docType} - {d.status} - {d.consecutive || d.key || d.id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {issueOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIssueOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white text-slate-900 border shadow-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-slate-500">Electronic invoicing</div>
                  <div className="text-lg font-semibold">
                    Issue {issueType} for order {issueOrder?.id?.slice?.(0, 8) || ""}
                  </div>
                </div>
                <RestaurantCloseXButton onClick={() => setIssueOpen(false)} />
              </div>

              {issueType === "FE" && (
                <div className="grid gap-2">
                  <input
                    className="h-10 rounded-lg border px-3 text-sm"
                    placeholder="Receiver name"
                    value={issueReceiver.name}
                    onChange={(e) => setIssueReceiver((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    className="h-10 rounded-lg border px-3 text-sm"
                    placeholder="Receiver email (optional)"
                    value={issueReceiver.email}
                    onChange={(e) => setIssueReceiver((p) => ({ ...p, email: e.target.value }))}
                  />
                  <div className="text-xs text-slate-500">For TE you can issue without receiver details.</div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button className="h-10 px-4 rounded-xl border" onClick={() => setIssueOpen(false)} disabled={issuing}>
                  Cancel
                </button>
                <button
                  className="h-10 px-4 rounded-xl bg-violet-700 text-white hover:bg-violet-600 disabled:bg-violet-700/40"
                  onClick={doIssue}
                  disabled={issuing}
                >
                  {issuing ? "Issuing..." : "Issue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
