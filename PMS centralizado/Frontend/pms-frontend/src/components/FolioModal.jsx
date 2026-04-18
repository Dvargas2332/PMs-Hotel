import React, { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, CreditCard, Check, Printer } from "lucide-react";
import { api } from "../lib/api";

const PAYMENT_METHODS = ["EFECTIVO", "TARJETA_CREDITO", "TARJETA_DEBITO", "TRANSFERENCIA", "DEPOSITO", "OTRO"];

function fmt(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }) {
  const map = {
    DRAFT:    "bg-amber-100 text-amber-700",
    ISSUED:   "bg-emerald-100 text-emerald-700",
    CANCELED: "bg-red-100 text-red-700",
    REFUNDED: "bg-blue-100 text-blue-700",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

function PrintView({ inv, currency, total, paid, balance }) {
  const guestName = `${inv?.guest?.firstName || ""} ${inv?.guest?.lastName || ""}`.trim() || inv?.guest?.email || "-";
  const fmt2 = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div style={{ fontFamily: "monospace", fontSize: 13, padding: 24, maxWidth: 520 }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: "bold", fontSize: 16 }}>FOLIO DE HABITACIÓN</div>
        <div>No. {inv?.number}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: "#555" }}>
          {new Date().toLocaleString()}
        </div>
      </div>
      <hr />
      <div style={{ margin: "8px 0" }}>
        <div><b>Huésped:</b> {guestName}</div>
        <div><b>Habitación:</b> {inv?.reservation?.room?.number || "-"}</div>
        <div><b>Check-in:</b> {inv?.reservation?.checkIn ? new Date(inv.reservation.checkIn).toLocaleDateString() : "-"}</div>
        <div><b>Check-out:</b> {inv?.reservation?.checkOut ? new Date(inv.reservation.checkOut).toLocaleDateString() : "-"}</div>
        {inv?.reservation?.code && <div><b>Reserva:</b> {inv.reservation.code}</div>}
      </div>
      <hr />
      <div style={{ marginTop: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc" }}>
              <th style={{ textAlign: "left", paddingBottom: 4 }}>Descripción</th>
              <th style={{ textAlign: "center", width: 40 }}>Cant.</th>
              <th style={{ textAlign: "right", width: 80 }}>P.Unit.</th>
              <th style={{ textAlign: "right", width: 80 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv?.items || []).map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ paddingTop: 3 }}>{item.description}</td>
                <td style={{ textAlign: "center" }}>{item.quantity}</td>
                <td style={{ textAlign: "right" }}>{fmt2(item.unitPrice)}</td>
                <td style={{ textAlign: "right" }}>{fmt2(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <hr style={{ marginTop: 8 }} />
      <div style={{ marginTop: 8, textAlign: "right", fontSize: 13 }}>
        <div>Total: <b>{currency} {fmt2(total)}</b></div>
        <div>Pagado: {currency} {fmt2(paid)}</div>
        <div style={{ fontWeight: "bold", color: balance > 0 ? "#dc2626" : "#16a34a" }}>
          Saldo: {currency} {fmt2(balance)}
        </div>
      </div>
      {(inv?.payments || []).length > 0 && (
        <>
          <hr style={{ marginTop: 8 }} />
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <b>Pagos:</b>
            {inv.payments.map((p) => (
              <div key={p.id}>{new Date(p.createdAt).toLocaleDateString()} — {p.method.replace("_", " ")} — {currency} {fmt2(p.amount)}</div>
            ))}
          </div>
        </>
      )}
      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: "#888" }}>
        Gracias por su visita
      </div>
    </div>
  );
}

export default function FolioModal({ invoiceId, onClose, onUpdated }) {
  const [inv, setInv]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [addItem, setAddItem]   = useState(false);
  const [addPmt, setAddPmt]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const printRef                = useRef(null);

  const [itemForm, setItemForm] = useState({ description: "", quantity: 1, unitPrice: "" });
  const [pmtForm, setPmtForm]   = useState({ method: "EFECTIVO", amount: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/invoices/${invoiceId}`);
      setInv(data);
    } catch {
      setError("No se pudo cargar el folio");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [invoiceId]);

  async function handleAddItem() {
    if (!itemForm.description || !itemForm.unitPrice) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/invoices/${invoiceId}/items`, {
        description: itemForm.description,
        quantity:    Number(itemForm.quantity || 1),
        unitPrice:   Number(itemForm.unitPrice),
      });
      setInv(data);
      setItemForm({ description: "", quantity: 1, unitPrice: "" });
      setAddItem(false);
      onUpdated?.();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al agregar cargo");
    }
    setSaving(false);
  }

  async function handleRemoveItem(itemId) {
    if (!confirm("¿Eliminar este cargo?")) return;
    try {
      const { data } = await api.delete(`/invoices/${invoiceId}/items/${itemId}`);
      setInv(data);
      onUpdated?.();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al eliminar cargo");
    }
  }

  async function handleAddPayment() {
    if (!pmtForm.method || !pmtForm.amount) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/invoices/${invoiceId}/payments`, {
        method: pmtForm.method,
        amount: Number(pmtForm.amount),
      });
      setInv(data);
      setPmtForm({ method: "EFECTIVO", amount: "" });
      setAddPmt(false);
      onUpdated?.();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al registrar pago");
    }
    setSaving(false);
  }

  async function handleRemovePayment(pmtId) {
    if (!confirm("¿Eliminar este pago?")) return;
    try {
      const { data } = await api.delete(`/invoices/${invoiceId}/payments/${pmtId}`);
      setInv(data);
      onUpdated?.();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al eliminar pago");
    }
  }

  function handlePrint() {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=600,height=700");
    win.document.write(`<html><head><title>Folio ${inv?.number || ""}</title><style>body{margin:0;padding:0}</style></head><body>`);
    win.document.write(el.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.focus();
    win.print();
  }

  async function handleStatusChange(status) {
    if (!confirm(`¿Cambiar estado a ${status}?`)) return;
    try {
      const { data } = await api.patch(`/invoices/${invoiceId}/status`, { status });
      setInv(data);
      onUpdated?.();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al cambiar estado");
    }
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 text-slate-600">Cargando folio...</div>
    </div>
  );

  const total     = Number(inv?.total || 0);
  const paid      = (inv?.payments || []).reduce((s, p) => s + Number(p.amount), 0);
  const balance   = total - paid;
  const currency  = inv?.reservation?.room?.currency || inv?.reservation?.ratePlan?.currency || "CRC";
  const guestName = `${inv?.guest?.firstName || ""} ${inv?.guest?.lastName || ""}`.trim() || inv?.guest?.email || "-";
  const canEdit   = inv?.status !== "CANCELED" && inv?.status !== "ISSUED";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Folio — {inv?.number}</h2>
            <p className="text-xs text-slate-500">{guestName} · Hab. {inv?.reservation?.room?.number || "-"} · {inv?.reservation?.code || ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={inv?.status} />
            <button onClick={handlePrint} title="Imprimir folio" className="text-slate-400 hover:text-slate-700 p-1 rounded">
              <Printer className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {error && <p className="text-sm text-red-500 bg-red-50 rounded px-3 py-2">{error}</p>}

          {/* Charges / Items */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-slate-700">Cargos</h3>
              {canEdit && (
                <button onClick={() => setAddItem(v => !v)} className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 text-slate-600">
                  <Plus className="w-3.5 h-3.5" /> Agregar cargo
                </button>
              )}
            </div>

            {addItem && (
              <div className="grid grid-cols-12 gap-2 mb-3 p-3 bg-slate-50 rounded-lg">
                <input className="col-span-5 border rounded px-2 py-1.5 text-sm" placeholder="Descripción" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
                <input className="col-span-2 border rounded px-2 py-1.5 text-sm text-center" placeholder="Cant." type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))} />
                <input className="col-span-3 border rounded px-2 py-1.5 text-sm text-right" placeholder="Precio unit." type="number" value={itemForm.unitPrice} onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))} />
                <button onClick={handleAddItem} disabled={saving} className="col-span-2 bg-emerald-600 text-white text-xs rounded px-2 py-1.5 hover:bg-emerald-500 flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5" /> OK
                </button>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-center w-16">Cant.</th>
                    <th className="px-3 py-2 text-right w-28">P. Unitario</th>
                    <th className="px-3 py-2 text-right w-28">Total</th>
                    {canEdit && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {(inv?.items || []).length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Sin cargos registrados</td></tr>
                  )}
                  {(inv?.items || []).map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{fmt(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(item.total)}</td>
                      {canEdit && (
                        <td className="px-1 py-2 text-center">
                          <button onClick={() => handleRemoveItem(item.id)} className="text-slate-300 hover:text-red-400 p-0.5 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Payments */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-slate-700">Pagos</h3>
              {canEdit && (
                <button onClick={() => setAddPmt(v => !v)} className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 text-slate-600">
                  <CreditCard className="w-3.5 h-3.5" /> Registrar pago
                </button>
              )}
            </div>

            {addPmt && (
              <div className="grid grid-cols-12 gap-2 mb-3 p-3 bg-slate-50 rounded-lg">
                <select className="col-span-6 border rounded px-2 py-1.5 text-sm" value={pmtForm.method} onChange={e => setPmtForm(f => ({ ...f, method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                </select>
                <input className="col-span-4 border rounded px-2 py-1.5 text-sm text-right" placeholder="Monto" type="number" value={pmtForm.amount} onChange={e => setPmtForm(f => ({ ...f, amount: e.target.value }))} />
                <button onClick={handleAddPayment} disabled={saving} className="col-span-2 bg-emerald-600 text-white text-xs rounded px-2 py-1.5 hover:bg-emerald-500 flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5" /> OK
                </button>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Método</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-right w-28">Monto</th>
                    {canEdit && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody>
                  {(inv?.payments || []).length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">Sin pagos registrados</td></tr>
                  )}
                  {(inv?.payments || []).map(pmt => (
                    <tr key={pmt.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{pmt.method.replace("_", " ")}</td>
                      <td className="px-3 py-2 text-slate-500">{new Date(pmt.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right">{fmt(pmt.amount)}</td>
                      {canEdit && (
                        <td className="px-1 py-2 text-center">
                          <button onClick={() => handleRemovePayment(pmt.id)} className="text-slate-300 hover:text-red-400 p-0.5 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Footer — totals + actions */}
        <div className="border-t px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1 text-sm">
              <div className="flex gap-8">
                <span className="text-slate-500">Total</span>
                <span className="font-bold text-slate-800">{currency} {fmt(total)}</span>
              </div>
              <div className="flex gap-8">
                <span className="text-slate-500">Pagado</span>
                <span className="font-medium text-emerald-600">{currency} {fmt(paid)}</span>
              </div>
              <div className={`flex gap-8 font-bold text-base ${balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                <span>Saldo</span>
                <span>{currency} {fmt(balance)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 items-end">
              {inv?.status === "DRAFT" && (
                <button onClick={() => handleStatusChange("ISSUED")} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500 font-medium">
                  Emitir factura
                </button>
              )}
              {inv?.status === "DRAFT" && (
                <button onClick={() => handleStatusChange("CANCELED")} className="px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 border border-red-200">
                  Cancelar factura
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hidden print template */}
        <div ref={printRef} style={{ display: "none" }}>
          <PrintView inv={inv} currency={currency} total={total} paid={paid} balance={balance} />
        </div>
      </div>
    </div>
  );
}
