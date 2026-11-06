import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import {
  Search, RefreshCw, User, Bed, Calendar, CreditCard, Wallet,
  ArrowRightLeft, DollarSign, LogOut, X, Hash, Pencil, ChevronRight, Check
} from "lucide-react";

export default function InHouseGuestsPage() {
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // modal state
  const [folio, setFolio] = useState(null);
  const [folioLoading, setFolioLoading] = useState(false);
  const [rooms, setRooms] = useState([]);

  const [showRoomPicker, setShowRoomPicker] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [resRes, roomsRes] = await Promise.all([api.get("/reservations/active"), api.get("/rooms")]);
      setStays(Array.isArray(resRes.data) ? resRes.data : []);
      setRooms(Array.isArray(roomsRes.data) ? roomsRes.data : []);
    } catch { setStays([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openFolio = async (reservation) => {
    setSelected(reservation);
    setFolio(null);
    setFolioLoading(true);
    try {
      const { data: invoices } = await api.get("/invoices");
      const inv = Array.isArray(invoices) ? invoices.find(i => i.reservationId === reservation.id) : null;
      if (inv) {
        const { data: full } = await api.get(`/invoices/${encodeURIComponent(inv.id || inv._id)}`);
        setFolio(full || inv);
      }
    } catch {}
    setFolioLoading(false);
  };

  const handleRoomChange = async (newRoomId) => {
    try {
      await api.patch(`/reservations/${selected.id}`, { roomId: newRoomId });
      setShowRoomPicker(false);
      setSelected(null);
      load();
    } catch (err) { alert(err?.response?.data?.message || "Error"); }
  };

  const handleAddCharge = async () => {
    if (!folio) return;
    const amt = prompt("Monto:");
    const desc = prompt("Descripción:");
    if (!amt || !desc) return;
    try {
      await api.post(`/invoices/${encodeURIComponent(folio.id || folio._id)}/items`, { description: desc, quantity: 1, unitPrice: Number(amt) });
      const { data } = await api.get(`/invoices/${encodeURIComponent(folio.id || folio._id)}`);
      setFolio(data);
    } catch (err) { alert(err?.response?.data?.message || "Error"); }
  };

  const handleRemoveCharge = async (itemId) => {
    if (!confirm("¿Eliminar este cargo?")) return;
    try {
      await api.delete(`/invoices/${encodeURIComponent(folio.id || folio._id)}/items/${itemId}`);
      const { data } = await api.get(`/invoices/${encodeURIComponent(folio.id || folio._id)}`);
      setFolio(data);
    } catch (err) { alert(err?.response?.data?.message || "Error"); }
  };

  const handleCheckOut = async () => {
    if (!confirm("¿Confirmar check-out?")) return;
    try {
      await api.post(`/reservations/${selected.id}/checkout`);
      setSelected(null);
      load();
    } catch (err) { alert(err?.response?.data?.message || "Error"); }
  };

  const handleAddPayment = async () => {
    if (!folio) return;
    const amt = prompt("Monto del pago:");
    const method = prompt("Método (Efectivo, Tarjeta, etc.):");
    if (!amt) return;
    try {
      await api.post(`/invoices/${encodeURIComponent(folio.id || folio._id)}/payments`, { amount: Number(amt), method: method || "Efectivo" });
      const { data } = await api.get(`/invoices/${encodeURIComponent(folio.id || folio._id)}`);
      setFolio(data);
    } catch (err) { alert(err?.response?.data?.message || "Error"); }
  };

  const filtered = stays.filter(s => {
    const t = search.toLowerCase();
    if (!t) return true;
    const name = `${s.guest?.firstName||""} ${s.guest?.lastName||""}`.toLowerCase();
    return name.includes(t) || (s.code||"").toLowerCase().includes(t) || (s.room?.number||"").toLowerCase().includes(t);
  });

  const inStyle = { borderColor: "var(--card-border)", background: "var(--card-bg)", color: "var(--color-text-base)" };
  const muted = { color: "var(--color-text-muted)" };

  if (loading && stays.length === 0) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-emerald-500" size={28}/></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={inStyle}>In House</h1>
          <p className="text-xs" style={muted}>{stays.length} en casa</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-30"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-40 pl-8 pr-3 py-2 rounded-lg border text-xs" style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}/>
          </div>
          <button onClick={load} className="p-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800" style={{ borderColor: "var(--card-border)" }}><RefreshCw size={16}/></button>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
        <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider border-b"
          style={{ borderColor: "var(--card-border)", color: "var(--color-text-muted)", background: "var(--input-bg)" }}>
          <div className="col-span-1">Folio</div><div className="col-span-2">Huésped</div><div className="col-span-2">Habitación</div>
          <div className="col-span-2">Entrada / Salida</div><div className="col-span-1">Noches</div><div className="col-span-1">Tarifa</div>
          <div className="col-span-1">Saldo</div><div className="col-span-2 text-right">Acciones</div>
        </div>
        {filtered.length === 0 && <div className="text-center py-12 text-sm" style={muted}>Sin huéspedes</div>}
        {filtered.map(r => {
          const nights = r.checkIn && r.checkOut ? Math.max(1, Math.ceil((new Date(r.checkOut) - new Date(r.checkIn)) / 86400000)) : 0;
          const rate = r.ratePlan?.price || r.room?.baseRate || 0;
          return (
            <div key={r.id} onClick={() => openFolio(r)}
              className="grid grid-cols-12 gap-2 px-4 py-3 text-xs items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b transition-colors"
              style={{ borderColor: "var(--card-border)" }}>
              <div className="col-span-1 font-mono font-medium" style={inStyle}>{r.code || r.id?.slice(0,8)}</div>
              <div className="col-span-2"><div className="font-medium truncate" style={inStyle}>
                {r.guest ? `${r.guest.firstName||""} ${r.guest.lastName||""}`.trim() : r.guestName || "Sin perfil"}</div></div>
              <div className="col-span-2"><span className="font-medium" style={inStyle}>Hab. {r.room?.number||"—"}</span><span className="text-[10px] ml-1" style={muted}>{r.room?.type||""}</span></div>
              <div className="col-span-2 text-[11px]" style={muted}><div>{r.checkIn ? new Date(r.checkIn).toLocaleDateString() : "—"}</div><div>→ {r.checkOut ? new Date(r.checkOut).toLocaleDateString() : "—"}</div></div>
              <div className="col-span-1 text-center font-medium" style={inStyle}>{nights}</div>
              <div className="col-span-1 font-medium" style={inStyle}>₡{Number(rate).toLocaleString()}</div>
              <div className="col-span-1 font-medium text-rose-500">—</div>
              <div className="col-span-2 text-right"><ChevronRight size={16} style={muted}/></div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL: Folio del huésped ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-3xl mx-3 rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto"
            style={inStyle} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--card-border)" }}>
              <div>
                <h2 className="font-bold text-lg" style={inStyle}>
                  {selected.guest ? `${selected.guest.firstName||""} ${selected.guest.lastName||""}`.trim() : selected.guestName || "Sin perfil"}
                </h2>
                <p className="text-xs" style={muted}>
                  {selected.code} · Hab. {selected.room?.number||"—"} · {selected.checkIn ? new Date(selected.checkIn).toLocaleDateString() : ""} → {selected.checkOut ? new Date(selected.checkOut).toLocaleDateString() : ""}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-black/5"><X size={18}/></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Actions bar */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setShowRoomPicker(true)}
                  className="px-3 py-2 rounded-lg border text-xs flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                  style={{ borderColor: "var(--card-border)", color: "var(--color-text-base)" }}>
                  <ArrowRightLeft size={13}/> Cambiar habitación
                </button>
                {folio && (
                  <>
                    <button onClick={handleAddCharge}
                      className="px-3 py-2 rounded-lg border text-xs flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                      style={{ borderColor: "var(--card-border)", color: "var(--color-text-base)" }}>
                      <DollarSign size={13}/> Agregar cargo
                    </button>
                    <button onClick={handleAddPayment}
                      className="px-3 py-2 rounded-lg border text-xs flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                      style={{ borderColor: "var(--card-border)", color: "var(--color-text-base)" }}>
                      <Wallet size={13}/> Registrar pago
                    </button>
                  </>
                )}
                <button onClick={handleCheckOut}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 flex items-center gap-1.5 ml-auto">
                  <LogOut size={13}/> Check-out
                </button>
              </div>

              {/* Guest info */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <div className="font-medium mb-1 flex items-center gap-1" style={muted}><User size={12}/> Datos</div>
                  {selected.guest ? (
                    <>
                      <div style={muted}>📧 {selected.guest.email || "—"}</div>
                      <div style={muted}>📞 {selected.guest.phone || "—"}</div>
                      <div style={muted}>🆔 {selected.guest.idType||""} {selected.guest.idNumber||""}</div>
                    </>
                  ) : <div style={muted}>Reserva sin perfil</div>}
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <div className="font-medium mb-1 flex items-center gap-1" style={muted}><Bed size={12}/> Habitación</div>
                  <div className="font-semibold" style={inStyle}>Hab. {selected.room?.number||"—"} ({selected.room?.type||""})</div>
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <div className="font-medium mb-1 flex items-center gap-1" style={muted}><Calendar size={12}/> Estancia</div>
                  <div className="font-semibold" style={inStyle}>{selected.checkIn ? new Date(selected.checkIn).toLocaleDateString() : ""} → {selected.checkOut ? new Date(selected.checkOut).toLocaleDateString() : ""}</div>
                </div>
              </div>

              {/* Folio */}
              {folioLoading ? <p className="text-xs text-center py-4" style={muted}>Cargando folio...</p> : folio ? (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "var(--card-border)" }}>
                    <div className="font-medium text-xs flex items-center gap-1.5" style={muted}>
                      <DollarSign size={13}/> Cargos — Folio #{folio.number || folio.id?.slice(0,8)}
                    </div>
                    {(folio.items || []).map((item, i) => (
                      <div key={i} className="flex justify-between text-xs group">
                        <span style={inStyle}>{item.description}</span>
                        <div className="flex items-center gap-1">
                          <span className="font-medium" style={inStyle}>₡{Number(item.total || item.unitPrice * (item.quantity||1)).toLocaleString()}</span>
                          <button onClick={() => handleRemoveCharge(item.id)} className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700"><X size={12}/></button>
                        </div>
                      </div>
                    ))}
                    {(!folio.items || folio.items.length === 0) && <p className="text-[10px] opacity-50">Sin cargos</p>}
                    <div className="border-t pt-1.5 flex justify-between font-semibold text-xs" style={{ borderColor: "var(--card-border)" }}>
                      <span style={muted}>Total</span><span style={inStyle}>₡{Number(folio.total || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border p-3 space-y-1.5" style={{ borderColor: "var(--card-border)" }}>
                    <div className="font-medium text-xs flex items-center gap-1.5" style={muted}><Wallet size={13}/> Pagos</div>
                    {(folio.payments || []).map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span style={inStyle}>{p.method || "Pago"}</span>
                        <span className="font-medium text-emerald-600">₡{Number(p.amount).toLocaleString()}</span>
                      </div>
                    ))}
                    {(!folio.payments || folio.payments.length === 0) && <p className="text-[10px] opacity-50">Sin pagos</p>}
                    <div className="border-t pt-1.5 flex justify-between font-semibold text-xs" style={{ borderColor: "var(--card-border)" }}>
                      <span style={muted}>Saldo</span>
                      <span className={Number(folio.total||0) - (folio.payments||[]).reduce((s,p) => s + Number(p.amount), 0) > 0 ? "text-rose-500" : "text-emerald-500"}>
                        ₡{(Number(folio.total||0) - (folio.payments||[]).reduce((s,p) => s + Number(p.amount), 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : <p className="text-xs text-center py-4" style={muted}>No se encontró factura para esta reserva</p>}
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL: Room Picker ── */}
      {showRoomPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowRoomPicker(false)}>
          <div className="w-full max-w-md mx-3 rounded-2xl border shadow-2xl max-h-[70vh] overflow-y-auto"
            style={inStyle} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--card-border)" }}>
              <h3 className="font-bold text-sm" style={inStyle}>Habitaciones disponibles</h3>
              <button onClick={() => setShowRoomPicker(false)} className="p-1 rounded-lg hover:bg-black/5"><X size={16}/></button>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {rooms.filter(r => ["AVAILABLE", "CLEANING"].includes(r.status) && !r.archived && r.id !== selected?.roomId).map(room => (
                <button key={room.id} onClick={() => handleRoomChange(room.id)}
                  className="rounded-xl border p-3 text-left hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all"
                  style={{ borderColor: "var(--card-border)" }}>
                  <div className="font-bold text-xs" style={inStyle}>Hab. {room.number}</div>
                  <div className="text-[10px]" style={muted}>{room.type || ""}</div>
                  <div className={`text-[10px] mt-0.5 ${room.status === "AVAILABLE" ? "text-emerald-600" : "text-amber-600"}`}>
                    {room.status === "AVAILABLE" ? "Disponible" : "Limpieza"}
                  </div>
                  {room.baseRate ? <div className="text-[10px] font-medium mt-0.5" style={inStyle}>₡{Number(room.baseRate).toLocaleString()}/noche</div> : null}
                </button>
              ))}
              {rooms.filter(r => ["AVAILABLE", "CLEANING"].includes(r.status) && !r.archived).length === 0 && (
                <p className="col-span-2 text-center py-8 text-xs" style={muted}>No hay habitaciones disponibles</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
