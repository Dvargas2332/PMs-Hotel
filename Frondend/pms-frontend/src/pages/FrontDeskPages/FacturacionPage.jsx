import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { pushAlert } from "../../lib/uiAlerts";
import { frontdeskTheme } from "../../theme/frontdeskTheme";

function Badge({ color = "gray", children }) {
  const cls = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-yellow-100 text-yellow-700",
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-100 text-blue-700",
  }[color];
  return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{children}</span>;
}

function fmtCurrency(n, { symbol = "", decimals = 0 } = {}) {
  const v = Number(n || 0);
  return `${symbol}${v.toFixed(decimals)}`;
}

function einvoiceBadgeColor(status) {
  if (!status) return "gray";
  const s = String(status).toUpperCase();
  if (["ACCEPTED"].includes(s)) return "green";
  if (["REJECTED", "CANCELED"].includes(s)) return "red";
  if (["SENT", "SIGNED", "CONTINGENCY"].includes(s)) return "yellow";
  return "gray";
}

export default function FacturacionPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [issuing, setIssuing] = useState({});
  const [currency, setCurrency] = useState({ code: "CRC", symbol: "", decimals: 0 });

  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    number: "",
    guest: "",
    room: "",
    status: "",
  });

  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const { data } = await api.get("/hotel/currency");
        setCurrency((c) => ({
          ...c,
          code: data?.base || c.code,
          symbol: data?.symbol ?? c.symbol,
          decimals: Number.isFinite(Number(data?.decimals)) ? Number(data.decimals) : c.decimals,
        }));
      } catch {
        // keep defaults
      }
    };
    loadCurrency();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
      const { data } = await api.get(`/api/invoices?${params.toString()}`);
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      pushAlert({ type: "system", title: "Billing", desc: "Could not load invoices." });
      setHistoryItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issueEDoc = async (inv, docType) => {
    const id = inv?.id;
    if (!id) return;
    setIssuing((s) => ({ ...s, [id + ":" + docType]: true }));
    try {
      const receiver = {
        name: `${inv.guest?.firstName || ""} ${inv.guest?.lastName || ""}`.trim(),
        email: inv.guest?.email || "",
      };
      const { data } = await api.post("/einvoicing/frontdesk/issue", {
        invoiceId: id,
        docType,
        receiver,
      });
      pushAlert({
        type: "system",
        title: "Electronic invoicing",
        desc: `${docType} created with status ${data?.status || "DRAFT"}.`,
      });
      await loadHistory();
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not create electronic document.";
      pushAlert({ type: "system", title: "Electronic invoicing", desc: msg });
    } finally {
      setIssuing((s) => {
        const next = { ...s };
        delete next[id + ":" + docType];
        return next;
      });
    }
  };

  const tableRows = useMemo(() => historyItems || [], [historyItems]);

  return (
    <div className="p-4 min-h-screen text-sm" style={{ background: frontdeskTheme.background.app }}>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Billing</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 rounded border bg-white hover:bg-slate-50"
            onClick={() => navigate("/e-invoicing")}
          >
            Electronic invoicing
          </button>
          <button
            className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-600/40"
            onClick={loadHistory}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-3 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs">
          <div className="flex flex-col gap-1">
            <span>From</span>
            <input
              className="border rounded px-2 py-1"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>To</span>
            <input
              className="border rounded px-2 py-1"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              placeholder="YYYY-MM-DD"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>Invoice #</span>
            <input
              className="border rounded px-2 py-1"
              value={filters.number}
              onChange={(e) => setFilters((f) => ({ ...f, number: e.target.value }))}
              placeholder="Search"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>Guest</span>
            <input
              className="border rounded px-2 py-1"
              value={filters.guest}
              onChange={(e) => setFilters((f) => ({ ...f, guest: e.target.value }))}
              placeholder="Name/email"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>Room</span>
            <input
              className="border rounded px-2 py-1"
              value={filters.room}
              onChange={(e) => setFilters((f) => ({ ...f, room: e.target.value }))}
              placeholder="Room"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>Status</span>
            <select
              className="border rounded px-2 py-1"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All</option>
              <option value="ISSUED">ISSUED</option>
              <option value="DRAFT">DRAFT</option>
              <option value="CANCELED">CANCELED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button className="px-3 py-1.5 rounded border text-xs" onClick={loadHistory} disabled={loading}>
            Apply filters
          </button>
          <button
            className="px-3 py-1.5 rounded border text-xs"
            onClick={() => {
              setFilters({ dateFrom: "", dateTo: "", number: "", guest: "", room: "", status: "" });
              setTimeout(loadHistory, 0);
            }}
            disabled={loading}
          >
            Clear
          </button>
        </div>

        <div className="overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Invoice #</th>
                <th className="px-2 py-2 text-left">Customer</th>
                <th className="px-2 py-2 text-left">Room</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">E-Doc</th>
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((inv) => {
                const guestName =
                  `${inv.guest?.firstName || ""} ${inv.guest?.lastName || ""}`.trim() || inv.guest?.email || "-";
                const roomLabel = inv.reservation?.room?.number || inv.reservation?.room?.type || "";
                const dateStr = inv.createdAt ? new Date(inv.createdAt).toLocaleString() : "";
                const docsFromJson = inv?.eInvoice?.docs || {};
                const docsFromRel = Array.isArray(inv?.eInvoicingDocuments) ? inv.eInvoicingDocuments : [];
                const pickLatest = (docType) =>
                  docsFromRel.find((d) => String(d?.docType || "").toUpperCase() === String(docType).toUpperCase()) || null;
                const fe = pickLatest("FE") || docsFromJson.FE || null;
                const te = pickLatest("TE") || docsFromJson.TE || null;
                return (
                  <tr key={inv.id} className="border-t hover:bg-slate-50">
                    <td className="px-2 py-1">{dateStr}</td>
                    <td className="px-2 py-1">{inv.number}</td>
                    <td className="px-2 py-1">{guestName}</td>
                    <td className="px-2 py-1">{roomLabel}</td>
                    <td className="px-2 py-1">
                      <Badge
                        color={
                          inv.status === "ISSUED"
                            ? "green"
                            : inv.status === "CANCELED"
                              ? "red"
                              : inv.status === "REFUNDED"
                                ? "yellow"
                                : "gray"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="px-2 py-1 rounded border text-[11px] hover:bg-slate-50"
                            disabled={Boolean(issuing[inv.id + ":FE"])}
                            onClick={() => issueEDoc(inv, "FE")}
                            title="Create Factura Electrónica (FE)"
                          >
                            {issuing[inv.id + ":FE"] ? "..." : "FE"}
                          </button>
                          {fe && <Badge color={einvoiceBadgeColor(fe.status)}>FE {String(fe.status || "").toUpperCase()}</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="px-2 py-1 rounded border text-[11px] hover:bg-slate-50"
                            disabled={Boolean(issuing[inv.id + ":TE"])}
                            onClick={() => issueEDoc(inv, "TE")}
                            title="Create Tiquete Electrónico (TE)"
                          >
                            {issuing[inv.id + ":TE"] ? "..." : "TE"}
                          </button>
                          {te && <Badge color={einvoiceBadgeColor(te.status)}>TE {String(te.status || "").toUpperCase()}</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right">{fmtCurrency(inv.total, currency)}</td>
                  </tr>
                );
              })}

              {!tableRows.length && !loading && (
                <tr>
                  <td className="px-2 py-4 text-center text-slate-500" colSpan={7}>
                    No invoices match the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
