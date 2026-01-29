import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, ChevronLeft } from "lucide-react";
import { api } from "../../lib/api";
import RestaurantUserMenu from "./RestaurantUserMenu";
import { io } from "socket.io-client";

const AREAS = [
  { id: "KITCHEN", label: "Kitchen" },
  { id: "BAR", label: "Bar" },
];

const STATUS_LABEL = {
  NEW: "New",
  IN_KITCHEN: "In prep",
  READY: "Ready",
  SERVED: "Served",
};

const nextStatusFor = (status) => {
  if (status === "NEW") return "IN_KITCHEN";
  if (status === "IN_KITCHEN") return "READY";
  if (status === "READY") return "SERVED";
  return null;
};

export default function KdsPage() {
  const navigate = useNavigate();
  const [area, setArea] = useState("KITCHEN");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const socketRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/restaurant/kds?area=${area}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Could not load KDS.");
    } finally {
      setLoading(false);
    }
  }, [area]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => refresh(), 1000 * 5);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const endpoint = process.env.REACT_APP_API_URL || window.location.origin;
    const s = io(endpoint, { transports: ["websocket"] });
    socketRef.current = s;
    const reload = () => refresh();
    s.on("kds:item", reload);
    s.on("order:updated", reload);
    s.on("order:paid", reload);
    s.on("order:voided", reload);
    s.on("order:moved", reload);
    return () => {
      s.off("kds:item", reload);
      s.off("order:updated", reload);
      s.off("order:paid", reload);
      s.off("order:voided", reload);
      s.off("order:moved", reload);
      s.disconnect();
    };
  }, [refresh]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of items || []) {
      const key = it?.order?.id || "unknown";
      const arr = map.get(key) || [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([orderId, arr]) => ({
      orderId,
      order: arr[0]?.order,
      items: arr,
    }));
  }, [items]);

  const counts = useMemo(() => {
    const c = { NEW: 0, IN_KITCHEN: 0, READY: 0, SERVED: 0 };
    for (const it of items || []) {
      const s = String(it?.status || "NEW").toUpperCase();
      if (c[s] != null) c[s] += 1;
    }
    return c;
  }, [items]);

  const updateItemStatus = async (orderItemId, nextStatus) => {
    if (!orderItemId || !nextStatus) return;
    try {
      await api.patch(`/restaurant/kds/${encodeURIComponent(orderItemId)}`, { status: nextStatus });
      setItems((prev) =>
        (prev || []).map((it) => (it.id === orderItemId ? { ...it, status: nextStatus } : it))
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", { detail: { title: "KDS", desc: "Could not update status." } })
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white text-black">
      <header className="h-14 flex items-center justify-between px-5 bg-white border-b border-slate-200 text-black shadow">
        <div className="flex items-center gap-3">
          <button
            className="h-9 px-3 rounded-lg bg-white hover:bg-white flex items-center gap-2 text-sm"
            onClick={() => navigate("/restaurant/pos")}
          >
            <ChevronLeft className="w-4 h-4" />
            POS
          </button>
          <div>
            <div className="text-xs uppercase text-black/80">KDS</div>
            <div className="text-sm font-semibold">Kitchen / bar screen</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1 rounded-lg bg-white">
            {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          <button
            className="h-9 px-3 rounded-lg bg-white hover:bg-white flex items-center gap-2"
            onClick={refresh}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <RestaurantUserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {AREAS.map((a) => (
              <button
                key={a.id}
                className={`h-10 px-4 rounded-xl border text-sm font-semibold ${
                  area === a.id ? "bg-lime-200 border-lime-600 text-black" : "bg-white border-black/10 text-black"
                }`}
                onClick={() => setArea(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-black">
            <div className="px-2 py-1 rounded bg-white">New: {counts.NEW}</div>
            <div className="px-2 py-1 rounded bg-white">Prep: {counts.IN_KITCHEN}</div>
            <div className="px-2 py-1 rounded bg-white">Ready: {counts.READY}</div>
          </div>
        </div>

        {error && <div className="text-sm text-red-300">{error}</div>}
        {!error && grouped.length === 0 && !loading && (
          <div className="text-sm text-black border border-slate-200 bg-white rounded-xl p-4">
            No pending items in {area === "KITCHEN" ? "kitchen" : "bar"}.
          </div>
        )}

        <div className="grid gap-3">
          {grouped.map((g) => (
            <div key={g.orderId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-black">Order</div>
                  <div className="text-lg font-semibold">
                    Table {g.order?.tableId || "-"} {g.order?.sectionId ? `(${g.order.sectionId})` : ""}
                  </div>
                  {g.order?.note && <div className="text-xs text-black mt-1">Note: {g.order.note}</div>}
                </div>
                <div className="text-xs text-black">
                  Updated:{" "}
                  {g.order?.updatedAt ? new Date(g.order.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                </div>
              </div>

              <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(g.items || []).map((it) => {
                  const status = String(it.status || "NEW").toUpperCase();
                  const next = nextStatusFor(status);
                  const statusLabel = STATUS_LABEL[status] || status;
                  const pill =
                    status === "READY"
                      ? "bg-lime-100 border-lime-300 text-black"
                      : status === "IN_KITCHEN"
                        ? "bg-lime-100 border-lime-500/40 text-black"
                        : "bg-white border-slate-200 text-black";
                  return (
                    <div key={it.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold leading-tight">
                            {it.qty}x {it.name}
                          </div>
                          {it.category && <div className="text-[11px] text-black">{it.category}</div>}
                        </div>
                        <div className={`px-2 py-1 rounded-lg border text-[11px] ${pill}`}>{statusLabel}</div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        {next ? (
                          <button
                            className="h-9 px-3 rounded-lg bg-lime-200 hover:bg-lime-300 text-black text-sm font-semibold"
                            onClick={() => updateItemStatus(it.id, next)}
                          >
                            {next === "IN_KITCHEN" ? "Start" : next === "READY" ? "Ready" : "Served"}
                          </button>
                        ) : (
                          <div className="text-xs text-black">No actions</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}






