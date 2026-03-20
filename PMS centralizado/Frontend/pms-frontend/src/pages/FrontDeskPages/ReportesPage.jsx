import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";

const SECTIONS = [
  {
    title: "Occupancy & Forecast",
    items: [
      "Daily and future occupancy",
      "Pick-up and pace vs history",
      "Arrivals / departures / no-show / cancellations",
      "Overstay / understay and mix by room type",
    ],
  },
  {
    title: "Revenue & KPIs",
    items: [
      "ADR, RevPAR, TrevPAR",
      "Revenue by segment / channel / rate / package",
      "YoY / MoM comparisons and vs budget/forecast",
      "Upsells and upgrades",
    ],
  },
  {
    title: "Distribution",
    items: [
      "Production by channel (direct, OTA, corporate)",
      "Estimated/paid commissions",
      "Rate parity: published vs sold",
    ],
  },
  {
    title: "Housekeeping & Maintenance",
    items: [
      "Room status (clean/dirty/OOS)",
      "Productivity: cleans per shift/time",
      "Maintenance tickets and resolution times",
    ],
  },
  {
    title: "Finance & Cash (hotel)",
    items: [
      "Cash closures by shift/user",
      "Payment mix (cash/card/other)",
      "Collections (city ledger) and aging",
      "Card batches and chargebacks",
    ],
  },
  {
    title: "Guests & Quality",
    items: [
      "Repeat stays and top guests/companies",
      "Cancellation reasons",
      "Feedback/surveys",
    ],
  },
  {
    title: "Audit",
    items: [
      "Sensitive changes log (rates, adjustments, voids)",
      "Cash openings / closings",
      "Access and permissions",
    ],
  },
];

export default function ReportesPage() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/cash-audits", {
          params: { module: "FRONTDESK" },
        });
        if (!cancelled) setAudits(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Could not load cash closures"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-emerald-900">Hotel Reports</h1>
          <p className="text-sm text-slate-600">Operational and financial reports for Front Desk.</p>
        </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="rounded-2xl border border-emerald-100 bg-white shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-800">{sec.title}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Hotel
              </span>
            </div>
            <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
              {sec.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
              <button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                View report
              </button>
            </div>
          ))}

          {/* Front Desk cash closures */}
          <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm p-4 space-y-3 md:col-span-2 xl:col-span-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-800">Front Desk Cash Closures</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Audit
              </span>
            </div>
            {loading && <div className="text-xs text-slate-500">Loading closures...</div>}
            {error && !loading && <div className="text-xs text-rose-600">{error}</div>}
            {!loading && !error && audits.length === 0 && (
              <div className="text-xs text-slate-500">No cash closures found.</div>
            )}
          {!loading && !error && audits.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-1 pr-3">Date</th>
                    <th className="py-1 pr-3">Module</th>
                    <th className="py-1 pr-3">Totals</th>
                    <th className="py-1 pr-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.slice(0, 20).map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-1 pr-3">
                        {a.createdAt ? new Date(a.createdAt).toLocaleString() : "-"}
                      </td>
                      <td className="py-1 pr-3 text-emerald-700">
                        {a.module === "RESTAURANT" ? "Restaurant" : "Front Desk"}
                      </td>
                      <td className="py-1 pr-3">
                        {a.totals
                          ? Object.entries(a.totals)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join("  •  ")
                          : "-"}
                      </td>
                      <td className="py-1 pr-3">{a.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
