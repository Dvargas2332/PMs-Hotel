import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import {
  CreditCard, Wallet, Search, X, Check, Eye, Printer,
  ArrowUpRight, FileText, Hash, DollarSign, Calendar
} from "lucide-react";

export default function PrePagosPage() {
  const { hotel } = useAuth();
  const [deposits, setDeposits] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState(["Efectivo", "Tarjeta", "Transferencia", "Sinpe Móvil", "Cheque"]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [previewDeposit, setPreviewDeposit] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    loadData();
    api.get("/reservations/payment-methods").then(({ data }) => {
      if (Array.isArray(data)?.length) setPaymentMethods(data);
    }).catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: resData } = await api.get("/reservations");
      const active = (resData || []).filter(r => r.status !== "CANCELED");
      setReservations(active);
      const all = [];
      for (const res of active) {
        try {
          const { data } = await api.get(`/reservations/deposits?reservationId=${res.id}`);
          if (Array.isArray(data)) data.forEach(d => all.push({ ...d, reservation: res }));
        } catch {}
      }
      setDeposits(all);
    } catch (err) {
      console.error("PrePagos load:", err);
    } finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const reservationId = f.get("reservationId") || undefined;
    const amount = Number(f.get("amount"));
    const description = f.get("description")?.trim();
    if (!description) return alert("La descripción es obligatoria");
    if (!amount) return;
    try {
      await api.post("/reservations/deposits", {
        reservationId,
        amount,
        voucher: f.get("voucher") || undefined,
        description,
        currency: f.get("currency") || "CRC",
        paymentMethod: f.get("paymentMethod") || undefined,
        note: f.get("note") || "",
      });
      setShowNewModal(false);
      loadData();
    } catch (err) {
      alert(err?.response?.data?.message || "Error");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este depósito?")) return;
    try { await api.delete(`/reservations/deposits/${id}`); loadData(); }
    catch { alert("Error al eliminar"); }
  };

  const handleApplyToInvoice = async (deposit) => {
    if (!deposit.reservationId) return;
    try {
      const { data: invoices } = await api.get("/invoices");
      const invoice = (Array.isArray(invoices) ? invoices : []).find(
        inv => inv.reservationId === deposit.reservationId || inv.reservation?.id === deposit.reservationId
      );
      if (!invoice) return alert("No hay factura asociada");
      await api.post(`/invoices/${invoice.id}/payments`, {
        method: deposit.paymentMethod || "AdvanceDeposit",
        amount: Number(deposit.amount),
      });
      alert("Depósito aplicado a la factura");
      loadData();
    } catch (err) {
      alert(err?.response?.data?.message || "Error al aplicar");
    }
  };

  const filtered = deposits.filter(d => {
    const t = search.toLowerCase();
    const match = !t ||
      (d.reservation?.code || "").toLowerCase().includes(t) ||
      (d.reservation?.guest?.firstName || "").toLowerCase().includes(t) ||
      (d.reservation?.guest?.lastName || "").toLowerCase().includes(t) ||
      (d.voucher || "").toLowerCase().includes(t) ||
      (d.description || "").toLowerCase().includes(t);
    if (filter === "applied") return match && d.appliedInvoice;
    if (filter === "pending") return match && !d.appliedInvoice;
    return match;
  });

  const totalDeposits = deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalApplied = deposits.filter(d => d.appliedInvoice).reduce((s, d) => s + Number(d.amount || 0), 0);

  const inputStyle = {
    borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)",
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 md:p-5 space-y-4 max-w-[1500px] mx-auto">
      {/* Header + KPIs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-base)" }}>Pre-pagos</h1>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Depósitos · Anticipos · Garantías</p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600">
          <Wallet size={14} /> Nuevo
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Total", v: `₡${totalDeposits.toLocaleString()}`, c: "text-emerald-500" },
          { l: "Aplicado", v: `₡${totalApplied.toLocaleString()}`, c: "text-blue-500" },
          { l: "Pendiente", v: `₡${(totalDeposits - totalApplied).toLocaleString()}`, c: "text-amber-500" },
        ].map(k => (
          <div key={k.l} className="rounded-xl border px-3 py-2.5 flex items-center gap-2" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
            <Wallet size={16} className={k.c} />
            <div><div className="text-sm font-bold" style={{ color: "var(--color-text-base)" }}>{k.v}</div><div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{k.l}</div></div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="w-full pl-8 pr-2.5 py-2 rounded-lg border text-xs" style={inputStyle} />
        </div>
        {["all","pending","applied"].map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium ${filter===k ? "bg-emerald-500 text-white":"hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            style={filter!==k?{color:"var(--color-text-muted)"}:{}}>
            {k==="all"?"Todos":k==="pending"?"Pendientes":"Aplicados"}
          </button>
        ))}
      </div>

      {/* Deposits list */}
      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-center py-12 rounded-xl border-2 border-dashed" style={{ borderColor: "var(--card-border)" }}>
            <Wallet size={28} className="mx-auto mb-2 opacity-15" />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{search ? "Sin resultados" : "Sin pre-pagos"}</p>
          </div>
        )}
        {filtered.map(d => {
          const res = d.reservation;
          const applied = !!d.appliedInvoice;
          return (
            <div key={d.id} className="rounded-xl border px-3 py-2.5 flex items-center gap-3 text-xs"
              style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${applied?"bg-blue-100 dark:bg-blue-900/20":"bg-amber-100 dark:bg-amber-900/20"}`}>
                {applied ? <Check size={13} className="text-blue-600"/> : <ArrowUpRight size={13} className="text-amber-600"/>}
              </div>
              <div className="flex-1 grid grid-cols-4 md:grid-cols-6 gap-2 items-center">
                <div>
                  <div className="font-semibold" style={{ color: "var(--color-text-base)" }}>
                    {d.voucher && <span className="text-[10px] opacity-50 mr-0.5">#{d.voucher}</span>}
                    {d.currency} {Number(d.amount).toLocaleString()}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {new Date(d.createdAt).toLocaleDateString()} · {d.paymentMethod || "—"}
                  </div>
                </div>
                <div className="hidden md:block">
                  {res ? <div className="truncate font-medium" style={{ color: "var(--color-text-base)" }}>{res.guest?.firstName} {res.guest?.lastName}</div> : <span className="opacity-40">—</span>}
                  {res && <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{res.code} · Hab.{res.room?.number||"—"}</div>}
                </div>
                <div className="hidden md:block">
                  {d.description && <div className="truncate" style={{ color: "var(--color-text-base)" }}>{d.description}</div>}
                  {d.note && <div className="text-[10px] opacity-60">{d.note}</div>}
                </div>
                <div>
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${applied?"bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400":"bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"}`}>
                    {applied ? "Aplicado" : "Pendiente"}
                  </span>
                </div>
                <div className="hidden md:block text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                  {res ? `${new Date(res.checkIn).toLocaleDateString()} → ${new Date(res.checkOut).toLocaleDateString()}` : "—"}
                </div>
                <div className="flex gap-1 justify-end">
                  <button onClick={() => setPreviewDeposit(d)} title="Ver documento"
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5"><Eye size={13}/></button>
                  <button onClick={() => window.print()} title="Imprimir"
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5"><Printer size={13}/></button>
                  {!applied && d.reservationId && (
                    <button onClick={() => handleApplyToInvoice(d)} className="text-[10px] px-2 py-0.5 rounded bg-blue-500 text-white hover:bg-blue-600">Aplicar</button>
                  )}
                  <button onClick={() => handleDelete(d.id)} title="Eliminar"
                    className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><X size={13}/></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL: Nuevo Pre-pago (compacto, flotante) ── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[1px]" onClick={() => setShowNewModal(false)}>
          <div className="w-full max-w-lg mx-3 rounded-2xl border shadow-2xl p-4 space-y-3"
            style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--color-text-base)" }}>
                <Wallet size={15} className="text-emerald-500"/> Nuevo Pre-pago
              </h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 rounded-lg hover:bg-black/5"><X size={16}/></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Reservación (opcional)</label>
                  <select name="reservationId" className="w-full rounded-lg border px-2.5 py-2 text-xs" style={inputStyle}>
                    <option value="">Sin reservación</option>
                    {reservations.filter(r => ["PENDING","CONFIRMED","CHECKED_IN"].includes(r.status)).map(r => (
                      <option key={r.id} value={r.id}>{r.code} — {r.guest?.firstName} {r.guest?.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Comprobante</label>
                  <input name="voucher" placeholder="#REC-001" className="w-full rounded-lg border px-2.5 py-2 text-xs" style={inputStyle}/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Monto *</label>
                  <input name="amount" type="number" required min="1" step="0.01" placeholder="0.00" className="w-full rounded-lg border px-2.5 py-2 text-xs" style={inputStyle}/>
                </div>
                <div>
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Moneda</label>
                  <select name="currency" defaultValue="CRC" className="w-full rounded-lg border px-2.5 py-2 text-xs" style={inputStyle}>
                    <option>CRC</option><option>USD</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Tipo pago</label>
                  <select name="paymentMethod" className="w-full rounded-lg border px-2.5 py-2 text-xs" style={inputStyle}>
                    <option value="">—</option>
                    {paymentMethods.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium mb-0.5 block opacity-50">Descripción *</label>
                <input name="description" required placeholder="Ej: Depósito de garantía 50% para reserva #..." className="w-full rounded-lg border px-2.5 py-2 text-xs" style={inputStyle}/>
              </div>
              <div>
                <label className="text-[10px] font-medium mb-0.5 block opacity-50">Nota</label>
                <input name="note" placeholder="Nota interna..." className="w-full rounded-lg border px-2.5 py-2 text-xs" style={inputStyle}/>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowNewModal(false)}
                  className="flex-1 rounded-lg py-2 text-xs font-medium border hover:bg-slate-50 dark:hover:bg-slate-800"
                  style={{ borderColor: "var(--card-border)", color: "var(--color-text-base)" }}>Cancelar</button>
                <button type="submit" className="flex-1 rounded-lg py-2 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Vista previa del documento ── */}
      {previewDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setPreviewDeposit(null)}>
          <div ref={printRef} className="w-full max-w-md mx-3 rounded-2xl border shadow-2xl p-5 space-y-3 bg-white dark:bg-slate-900"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="font-bold text-base">Recibo de Pre-pago</h3>
                <p className="text-[10px] opacity-50">{hotel?.name || "Hotel"}</p>
              </div>
              <button onClick={() => setPreviewDeposit(null)} className="p-1 rounded-lg hover:bg-black/5"><X size={16}/></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="opacity-50">Comprobante:</span> <strong>{previewDeposit.voucher || "—"}</strong></div>
              <div><span className="opacity-50">Fecha:</span> {new Date(previewDeposit.createdAt).toLocaleDateString()}</div>
              <div><span className="opacity-50">Monto:</span> <strong className="text-emerald-600">{previewDeposit.currency} {Number(previewDeposit.amount).toLocaleString()}</strong></div>
              <div><span className="opacity-50">Método:</span> {previewDeposit.paymentMethod || "—"}</div>
              <div className="col-span-2"><span className="opacity-50">Descripción:</span> {previewDeposit.description || "—"}</div>
            </div>
            {previewDeposit.reservation && (
              <div className="border-t pt-2 text-xs space-y-0.5">
                <div className="font-medium">{previewDeposit.reservation.guest?.firstName} {previewDeposit.reservation.guest?.lastName}</div>
                <div className="opacity-50">{previewDeposit.reservation.code} · Hab. {previewDeposit.reservation.room?.number||"—"}</div>
                <div className="opacity-50">{new Date(previewDeposit.reservation.checkIn).toLocaleDateString()} → {new Date(previewDeposit.reservation.checkOut).toLocaleDateString()}</div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800">
                <Printer size={13}/> Imprimir
              </button>
              <button onClick={() => setPreviewDeposit(null)} className="flex-1 py-2 rounded-lg text-xs font-medium border"
                style={{ borderColor: "var(--card-border)" }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
