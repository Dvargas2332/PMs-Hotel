import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { frontdeskTheme } from "../../theme/frontdeskTheme";
import { useLanguage } from "../../context/LanguageContext";

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function guestName(g, fallback) {
  const full = `${g?.firstName || ""} ${g?.lastName || ""}`.trim();
  return full || g?.email || fallback;
}

export default function InHouseGuestsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [stays, setStays] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/reservations/active");
      setStays(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Could not load in-house guests", err);
      setStays([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cards = useMemo(() => stays || [], [stays]);

  return (
    <div className="p-6 min-h-screen space-y-4" style={{ background: frontdeskTheme.background.app }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("frontdesk.inhouse.title")}</h1>
          <p className="text-sm text-slate-600">{t("frontdesk.inhouse.subtitle")}</p>
        </div>
        <button
          className="px-3 py-2 rounded border bg-white text-sm hover:bg-slate-50"
          onClick={load}
          disabled={loading}
        >
          {loading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
          {loading ? t("frontdesk.inhouse.loading") : t("frontdesk.inhouse.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((r) => {
            const g = r.guest || {};
            const roomLabel = r.room?.number || r.room?.type || "-";
            return (
              <div key={r.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{guestName(g, t("frontdesk.inhouse.guestFallback"))}</div>
                  <div className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800">
                    {t("frontdesk.inhouse.badge")}
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  <div><span className="text-slate-500">{t("frontdesk.inhouse.room")}:</span> {roomLabel}</div>
                  <div><span className="text-slate-500">{t("frontdesk.inhouse.checkin")}:</span> {formatDateTime(r.checkIn)}</div>
                  <div><span className="text-slate-500">{t("frontdesk.inhouse.checkout")}:</span> {formatDateTime(r.checkOut)}</div>
                </div>
                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  <div>{t("frontdesk.inhouse.email")}: {g.email || "-"}</div>
                  <div>{t("frontdesk.inhouse.phone")}: {g.phone || "-"}</div>
                  {g.idNumber ? <div>{t("frontdesk.inhouse.id")}: {`${g.idType || ""} ${g.idNumber}`.trim()}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
