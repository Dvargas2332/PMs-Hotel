import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { pushAlert } from "../../lib/uiAlerts";
import { frontdeskTheme } from "../../theme/frontdeskTheme";
import { useLanguage } from "../../context/LanguageContext";

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

export default function BillingPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [issuing, setIssuing] = useState({});
  const [currency, setCurrency] = useState({ code: "CRC", symbol: "", decimals: 0 });
  const [activeStays, setActiveStays] = useState([]);

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
      pushAlert({ type: "system", title: t("frontdesk.billing.title"), desc: t("frontdesk.billing.errors.loadFailed") });
      setHistoryItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveStays = async () => {
    try {
      const { data } = await api.get("/reservations/active");
      setActiveStays(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setActiveStays([]);
    }
  };

  useEffect(() => {
    loadHistory();
    loadActiveStays();
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
        title: t("frontdesk.billing.einvoiceTitle"),
        desc: t("frontdesk.billing.einvoiceCreated", { docType, status: data?.status || "DRAFT" }),
      });
      await loadHistory();
    } catch (err) {
      const msg = err?.response?.data?.message || t("frontdesk.billing.errors.einvoiceFailedFallback");
      pushAlert({ type: "system", title: t("frontdesk.billing.einvoiceTitle"), desc: msg });
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
        <h1 className="text-xl font-bold">{t("frontdesk.billing.title")}</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 rounded border bg-white hover:bg-slate-50"
            onClick={() => navigate("/e-invoicing")}
          >
            {t("frontdesk.billing.einvoiceTitle")}
          </button>
          <button
            className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-600/40"
            onClick={loadHistory}
            disabled={loading}
          >
            {loading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-3 shadow-sm space-y-3">
        <div className="space-y-2">
          <div className="text-sm font-semibold">{t("frontdesk.billing.activeCheckins")}</div>
          {activeStays.length === 0 ? (
            <div className="text-xs text-slate-500">{t("frontdesk.billing.noActiveCheckins")}</div>
          ) : (
            <div className="overflow-auto border rounded">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-2 text-left">{t("common.room")}</th>
                    <th className="px-2 py-2 text-left">{t("common.guest")}</th>
                    <th className="px-2 py-2 text-left">{t("frontdesk.billing.table.checkin")}</th>
                    <th className="px-2 py-2 text-left">{t("frontdesk.billing.table.checkout")}</th>
                    <th className="px-2 py-2 text-left">{t("frontdesk.billing.table.invoice")}</th>
                    <th className="px-2 py-2 text-right">{t("common.total")}</th>
                    <th className="px-2 py-2 text-right">{t("frontdesk.billing.table.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStays.map((r) => {
                    const guestName =
                      `${r.guest?.firstName || ""} ${r.guest?.lastName || ""}`.trim() || r.guest?.email || "-";
                    const roomLabel = r.room?.number || r.room?.type || "-";
                    const inv = r.invoice || null;
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-2 py-2">{roomLabel}</td>
                        <td className="px-2 py-2">{guestName}</td>
                        <td className="px-2 py-2">
                          {r.checkIn ? new Date(r.checkIn).toLocaleString() : "-"}
                        </td>
                        <td className="px-2 py-2">
                          {r.checkOut ? new Date(r.checkOut).toLocaleString() : "-"}
                        </td>
                        <td className="px-2 py-2">{inv?.number || "-"}</td>
                        <td className="px-2 py-2 text-right">
                          {fmtCurrency(inv?.total || 0, currency)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            className="px-2 py-1 rounded border text-xs"
                            onClick={() => navigate("/frontdesk/reservas")}
                          >
                            {t("frontdesk.billing.goToCheckout")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs">
          <div className="flex flex-col gap-1">
            <span>{t("common.from")}</span>
            <input
              className="border rounded px-2 py-1"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              placeholder={t("common.dateYMD")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>{t("common.to")}</span>
            <input
              className="border rounded px-2 py-1"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              placeholder={t("common.dateYMD")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>{t("frontdesk.billing.table.invoice")}</span>
            <input
              className="border rounded px-2 py-1"
              value={filters.number}
              onChange={(e) => setFilters((f) => ({ ...f, number: e.target.value }))}
              placeholder={t("common.search")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>{t("common.guest")}</span>
            <input
              className="border rounded px-2 py-1"
              value={filters.guest}
              onChange={(e) => setFilters((f) => ({ ...f, guest: e.target.value }))}
              placeholder={t("frontdesk.billing.filters.guestPlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>{t("common.room")}</span>
            <input
              className="border rounded px-2 py-1"
              value={filters.room}
              onChange={(e) => setFilters((f) => ({ ...f, room: e.target.value }))}
              placeholder={t("common.room")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span>{t("common.status")}</span>
            <select
              className="border rounded px-2 py-1"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">{t("common.all")}</option>
              <option value="ISSUED">{t("frontdesk.billing.status.issued")}</option>
              <option value="DRAFT">{t("frontdesk.billing.status.draft")}</option>
              <option value="CANCELED">{t("frontdesk.billing.status.canceled")}</option>
              <option value="REFUNDED">{t("frontdesk.billing.status.refunded")}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button className="px-3 py-1.5 rounded border text-xs" onClick={loadHistory} disabled={loading}>
            {t("common.applyFilters")}
          </button>
          <button
            className="px-3 py-1.5 rounded border text-xs"
            onClick={() => {
              setFilters({ dateFrom: "", dateTo: "", number: "", guest: "", room: "", status: "" });
              setTimeout(loadHistory, 0);
            }}
            disabled={loading}
          >
            {t("common.clear")}
          </button>
        </div>

        <div className="overflow-auto border rounded">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-2 text-left">{t("common.date")}</th>
                <th className="px-2 py-2 text-left">{t("frontdesk.billing.table.invoice")}</th>
                <th className="px-2 py-2 text-left">{t("frontdesk.billing.table.customer")}</th>
                <th className="px-2 py-2 text-left">{t("common.room")}</th>
                <th className="px-2 py-2 text-left">{t("common.status")}</th>
                <th className="px-2 py-2 text-left">{t("frontdesk.billing.table.edoc")}</th>
                <th className="px-2 py-2 text-right">{t("common.total")}</th>
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
                            title={t("frontdesk.billing.einvoiceCreate", { docType: "FE" })}
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
                            title={t("frontdesk.billing.einvoiceCreate", { docType: "TE" })}
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
                    {t("frontdesk.billing.noInvoices")}
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
