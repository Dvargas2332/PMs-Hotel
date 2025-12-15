import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { pushAlert } from "../../lib/uiAlerts";
import { frontdeskTheme } from "../../theme/frontdeskTheme";

/** --- Utilidades UI --- **/
function Badge({ color = "gray", children }) {
  const cls = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-100 text-blue-700",
  }[color];
  return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{children}</span>;
}

function Modal({ open, onClose, title, children, size }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
        <div
          className={`
            w-[98vw] sm:w-auto
            ${size || ""}                     /* respeta size si lo pasas (p.ej. max-w-4xl) */
            sm:max-w-[95vw] lg:max-w-[1200px] xl:max-w-[1400px]
            rounded-xl bg-white shadow-xl border text-sm
            flex flex-col
          `}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-semibold">{title}</h3>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 text-lg leading-none flex items-center justify-center hover:bg-amber-200"
            >
              X
            </button>
          </div>
          {/* Contenido con altura limitada y scroll */}
          <div className="p-3 overflow-y-auto max-h-[80vh]">{children}</div>
        </div>
      </div>
    </div>
  );
}


/** Helpers de moneda **/
function stepFromDecimals(decimals = 2) {
  if (!decimals) return 1;
  return Number("0." + "0".repeat(decimals - 1) + "1");
}
function fmtCurrency(n, { symbol = "$", decimals = 2 } = {}) {
  const v = Number(n || 0);
  return `${symbol}${v.toFixed(decimals)}`;
}

/** --- Modal: Autorizacion para eliminar item --- **/
function RemovalAuthModal({ open, onClose, onConfirm, item }) {
  const [user, setUser] = useState("");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");

  React.useEffect(() => {
    if (open) {
      setUser("");
      setPin("");
      setReason("");
    }
  }, [open]);

  const canConfirm = user.trim() && pin.trim() && reason.trim();
  const submit = () => {
    if (!canConfirm) return;
    onConfirm({ user, pin, reason });
  };

  return (
    <Modal open={open} onClose={onClose} title="Autorizacion requerida" size="max-w-md">
      <div className="space-y-2">
        <div className="text-xs text-gray-600">
          Para eliminar el item <strong>{item?.description || "(sin descripcion)"}</strong> se requiere autorizacion y un motivo.
        </div>
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="text-xs text-gray-500">Usuario que autoriza</label>
            <input className="w-full border rounded px-2 py-1" value={user} onChange={(e) => setUser(e.target.value)} placeholder="Ej. Supervisor" />
          </div>
          <div>
            <label className="text-xs text-gray-500">PIN/clave</label>
            <input className="w-full border rounded px-2 py-1" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Motivo</label>
            <textarea
              className="w-full border rounded px-2 py-1"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explique por que se elimina el item"
            />
          </div>
        </div>

        <div className="pt-2 flex gap-2 justify-end">
          <button className="px-3 py-2 rounded border text-sm" onClick={onClose}>Cancelar</button>
          <button
            className={`px-3 py-2 rounded text-sm ${canConfirm ? "bg-red-600 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
            onClick={submit}
            disabled={!canConfirm}
          >
            Autorizar y eliminar
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** --- Modal: Selector de Perfil de Cliente (FE) --- **/
function CustomerProfileModal({ open, onClose, profiles = [], onSelect }) {
  const [q, setQ] = useState("");
  React.useEffect(() => { if (open) setQ(""); }, [open]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return profiles;
    return profiles.filter(p =>
      p.name.toLowerCase().includes(s) ||
      (p.idNumber || "").toLowerCase().includes(s) ||
      (p.email || "").toLowerCase().includes(s)
    );
  }, [q, profiles]);

  return (
    <Modal open={open} onClose={onClose} title="Seleccionar perfil del cliente" size="max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <input className="border rounded px-2 py-1 w-full" placeholder="Buscar por nombre, identificacin o emailO" value={q} onChange={(e)=>setQ(e.target.value)} />
        <button className="px-2 py-1 rounded border" onClick={()=>setQ("")}>Limpiar</button>
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-auto">
        {filtered.map(p => (
          <div key={p.id} className="border rounded p-2 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{p.name}</div>
              <div className="text-xs text-gray-500">
                {p.idType}{p.idNumber ? `: ${p.idNumber}` : ""} {p.email ? ` ${p.email}` : ""}
              </div>
            </div>
            <button className="px-2 py-1 rounded border text-xs" onClick={()=>{ onSelect(p); onClose(); }}>
              Usar este perfil
            </button>
          </div>
        ))}
        {!filtered.length && <div className="text-xs text-gray-500">Sin resultados.</div>}
      </div>
    </Modal>
  );
}

/** --- Modal: Nueva/Editar Factura --- **/
function NewInvoiceModal({ open, onClose, onSave, paymentMethods, preset, management }) {
  const isCheckout = preset?.source === "checkout";
  const { currency, taxRate: mgmtTaxRate } = management || { currency: { code: "USD", symbol: "$", decimals: 2 }, taxRate: 13 };

  const [guest, setGuest] = useState(preset?.guest || "");
  const [room, setRoom]  = useState(preset?.room  || "");
  const [items, setItems] = useState(preset?.items || [{ description: "", qty: 1, price: 0 }]);
  const [payments, setPayments] = useState([]);

  // FE: estado + perfil seleccionado
  const [eInvoice, setEInvoice] = useState({ enabled: false, profile: null });
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  // Perfiles (mock; conctalo a tu backend)
  const customerProfiles = [
    { id: "pf-cf",  name: "Consumidor final", idType: "CF", idNumber: "", email: "" },
    { id: "pf-jr1", name: "Empresa XYZ S.A.", idType: "Cdula Jurdica", idNumber: "3-101-123456", email: "facturacion@xyz.com" },
    { id: "pf-ph1", name: "Juan Prez", idType: "Cdula Fsica", idNumber: "1-2345-6789", email: "juan.perez@mail.com" },
  ];

  // Auditora de eliminaciones
  const [auditTrail, setAuditTrail] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [pendingRemovalIndex, setPendingRemovalIndex] = useState(null);
  const [pendingRemovalItem, setPendingRemovalItem] = useState(null);

  React.useEffect(() => {
    if (open) {
      setGuest(preset?.guest || "");
      setRoom(preset?.room || "");
      setItems(preset?.items || [{ description: "", qty: 1, price: 0 }]);
      setPayments([]);
      setAuditTrail([]);
      setShowAuth(false);
      setPendingRemovalIndex(null);
      setPendingRemovalItem(null);
      setEInvoice({ enabled: false, profile: null });
    }
  }, [open, preset]);

  const addItem = () => setItems((x) => [...x, { description: "", qty: 1, price: 0 }]);

  // Eliminar tem con autorizacin
  const requestRemoveItem = (idx) => {
    const it = items[idx];
    setPendingRemovalIndex(idx);
    setPendingRemovalItem(it);
    setShowAuth(true);
  };
  const confirmRemoval = ({ user, pin, reason }) => {
    const idx = pendingRemovalIndex;
    const it = pendingRemovalItem;
    setItems((x) => x.filter((_, i) => i !== idx));
    setAuditTrail((logs) => [
      ...logs,
      {
        type: "ITEM_REMOVED",
        at: new Date().toISOString(),
        authorizedBy: user,
        pinUsed: "****",
        reason,
        item: { ...it, index: idx },
      },
    ]);
    setShowAuth(false);
    setPendingRemovalIndex(null);
    setPendingRemovalItem(null);
  };

  const updateItem = (idx, fn) =>
    setItems((x) => x.map((it, i) => (i === idx ? fn({ ...it }) : it)));

  const subTotal = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.price) || 0), 0),
    [items]
  );
  const tax = useMemo(() => subTotal * (Number(mgmtTaxRate) || 0) / 100, [subTotal, mgmtTaxRate]);
  const total = useMemo(() => subTotal + tax, [subTotal, tax]);
  const paid  = useMemo(() => payments.reduce((a, p) => a + (Number(p.amount) || 0), 0), [payments]);
  const due   = useMemo(() => Math.max(0, total - paid), [total, paid]);

  const addPayment = () =>
    setPayments((x) => [...x, { method: paymentMethods[0] || "Efectivo", amount: 0, ref: "", cardLast4: "" }]);

  const updatePayment = (idx, fn) =>
    setPayments((x) => x.map((p, i) => (i === idx ? fn({ ...p }) : p)));

  const removePayment = (idx) => setPayments((x) => x.filter((_, i) => i !== idx));

  const handleSave = () => {
    // Validaciones de pago con tarjeta
    for (const p of payments) {
      if (p.method === "Tarjeta" && Number(p.amount) > 0) {
        const last4 = String(p.cardLast4 || "").trim();
        if (!/^\d{4}$/.test(last4)) {
          pushAlert({
            type: "payment",
            title: "Datos de tarjeta incompletos",
            desc: "Para pagos con tarjeta ingresa los ultimos 4 digitos de la tarjeta.",
          });
          return;
        }
      }
    }
    if (eInvoice.enabled && !eInvoice.profile) {
      pushAlert({
        type: "payment",
        title: "Cliente no seleccionado",
        desc: "Para emitir factura electronica, selecciona primero un perfil de cliente.",
      });
      return;
    }
    const payload = {
      number: null,
      guest,
      room,
      items,
      totals: { subTotal, tax, total, paid, due, taxRate: mgmtTaxRate },
      payments,
      status: due <= 0 ? "Pagada" : paid > 0 ? "Parcial" : "Pendiente",
      date: new Date().toISOString().slice(0, 10),
      source: preset?.source || "manual",
      auditTrail,
      eInvoice,
      currency, // til para backend/impresin
    };
    onSave(payload);
    onClose();
  };

  const priceStep = stepFromDecimals(currency.decimals);

  return (
    <>
      <Modal open={open} onClose={onClose} title="Nueva factura" size="max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 bg-white rounded border p-3">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs text-gray-500">
                  Huesped {isCheckout && <Badge color="gray">Bloqueado (check-out)</Badge>}
                </label>
                <input
                  className={`w-full border rounded px-2 py-1 ${isCheckout ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  value={guest}
                  onChange={(e) => setGuest(e.target.value)}
                  placeholder="Nombre del huesped"
                  disabled={isCheckout}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">
                  Habitacion {isCheckout && <Badge color="gray">Bloqueado (check-out)</Badge>}
                </label>
                <input
                  className={`w-full border rounded px-2 py-1 ${isCheckout ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="Ej. 203"
                  disabled={isCheckout}
                />
              </div>
            </div>

            {/* Factura Electrnica - Perfil del cliente */}
            <div className="mb-3 border rounded p-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">Factura electrnica</div>
                <label className="flex items-center gap-2 text-xs">
                  <span>{eInvoice.enabled ? "Activada" : "Desactivada"}</span>
                  <input
                    type="checkbox"
                    checked={eInvoice.enabled}
                    onChange={(e)=> setEInvoice(s => ({ ...s, enabled: e.target.checked }))}
                  />
                </label>
              </div>

              {eInvoice.enabled && (
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="text-xs">
                    <div className="font-medium">
                      {eInvoice.profile?.name || "Sin perfil seleccionado"}
                    </div>
                    {eInvoice.profile ? (
                      <div className="text-gray-500">
                        {eInvoice.profile.idType}{eInvoice.profile.idNumber ? `: ${eInvoice.profile.idNumber}` : ""}
                        {eInvoice.profile.email ? `  ${eInvoice.profile.email}` : ""}
                      </div>
                    ) : (
                      <div className="text-gray-500">Seleccione un perfil para emitir la FE.</div>
                    )}
                  </div>
                  <div className="shrink-0 flex gap-1">
                    <button className="px-2 py-1 rounded border text-xs" onClick={()=> setShowProfilePicker(true)}>
                      Cambiar perfil
                    </button>
                    {eInvoice.profile && (
                      <button className="px-2 py-1 rounded border text-xs" onClick={()=> setEInvoice(s => ({ ...s, profile: null }))}>
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold">tems</h4>
              <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={addItem}>
                + Agregar item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-1 pr-2">Descripcion</th>
                    <th className="py-1 pr-2 w-20">Cant.</th>
                    <th className="py-1 pr-2 w-28">Precio</th>
                    <th className="py-1 pr-2 w-28">Importe</th>
                    <th className="py-1 pr-1 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const qty = Number(it.qty) || 0;
                    const price = Number(it.price) || 0;
                    const line = qty * price;
                    return (
                      <tr key={idx} className="border-b">
                        <td className="py-1 pr-2">
                          <input className="w-full border rounded px-2 py-1"
                                 value={it.description}
                                 onChange={(e) => updateItem(idx, (x) => ({ ...x, description: e.target.value }))}/>
                        </td>
                        <td className="py-1 pr-2">
                          <input type="number" min={0}
                                 className="w-full border rounded px-2 py-1"
                                 value={it.qty}
                                 onChange={(e) => updateItem(idx, (x) => ({ ...x, qty: e.target.value }))}/>
                        </td>
                        <td className="py-1 pr-2">
                          <input type="number" min={0} step={priceStep}
                                 className="w-full border rounded px-2 py-1"
                                 value={it.price}
                                 onChange={(e) => updateItem(idx, (x) => ({ ...x, price: e.target.value }))}/>
                        </td>
                        <td className="py-1 pr-2 select-none">
                          {fmtCurrency(line, currency)}
                        </td>
                        <td className="py-1 pr-1 text-right">
                          <button
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                            onClick={() => requestRemoveItem(idx)}
                            title="Eliminar tem (requiere autorizacin)"
                          >
                            
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-xs text-gray-500">Impuesto</div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 border rounded bg-gray-100 select-none">
                    {mgmtTaxRate}% 
                  </div>
                  
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-xs">
                  Sub-total: <strong>{fmtCurrency(subTotal, currency)}</strong>
                </div>
                <div className="text-xs">
                  Impuesto: <strong>{fmtCurrency(tax, currency)}</strong>
                </div>
                <div>
                  Total: <strong>{fmtCurrency(total, currency)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Pagos */}
          <div className="bg-white rounded border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold">Pagos</h4>
              <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={addPayment}>
                + Agregar pago
              </button>
            </div>

            <div className="space-y-2">
              {payments.map((p, idx) => (
                <div key={idx} className="border rounded p-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <select
                        className="border rounded px-2 py-1 text-xs"
                        value={p.method}
                        onChange={(e) =>
                          updatePayment(idx, (x) => {
                            const method = e.target.value;
                            const next = { ...x, method };
                            if (method !== "Tarjeta") next.cardLast4 = "";
                            if (method === "Efectivo") next.ref = "";
                            return next;
                          })
                        }
                      >
                        {paymentMethods.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      {/* Monto: respeta decimales de la moneda */}
                      <input
                        type="number"
                        min={0}
                        step={stepFromDecimals(currency.decimals)}
                        className="border rounded px-2 py-1 text-xs w-32"
                        placeholder="Monto"
                        value={p.amount}
                        onChange={(e) => updatePayment(idx, (x) => ({ ...x, amount: e.target.value }))}
                      />
                      {/* Campos segn mtodo */}
                      {p.method === "Tarjeta" && (
                        <input
                          className="border rounded px-2 py-1 text-xs w-28"
                          placeholder="ltimos 4"
                          value={p.cardLast4 || ""}
                          onChange={(e) =>
                            updatePayment(idx, (x) => ({ ...x, cardLast4: e.target.value.replace(/\D/g, "").slice(0, 4) }))
                          }
                        />
                      )}
                      

                      <button
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                        onClick={() => removePayment(idx)}
                      >
                        
                      </button>
                    </div>

                    {/* Info auxiliar de moneda */}
                    {p.method === "Efectivo" && (
                      <div className="text-[11px] text-gray-500">
                        Moneda: <strong>{currency.code}</strong>  Decimales: <strong>{currency.decimals}</strong>  Paso: <strong>{stepFromDecimals(currency.decimals)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-sm space-y-1">
              <div>Pagado: <strong>{fmtCurrency(paid, currency)}</strong></div>
              <div>
                Pendiente:{" "}
                <strong className={due > 0 ? "text-red-600" : "text-green-700"}>
                  {fmtCurrency(due, currency)}
                </strong>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button className="px-3 py-2 rounded bg-blue-600 text-white text-sm" onClick={handleSave}>
                Guardar
              </button>
              <button className="px-3 py-2 rounded border text-sm" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modales secundarios */}
      <RemovalAuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onConfirm={confirmRemoval}
        item={pendingRemovalItem}
      />
      <CustomerProfileModal
        open={showProfilePicker}
        onClose={() => setShowProfilePicker(false)}
        profiles={customerProfiles}
        onSelect={(p)=> setEInvoice(s => ({ ...s, profile: p }))}
      />
    </>
  );
}

/** --- Modal: Listado de huespedes para Check-out --- **/
function CheckoutGuestsModal({ open, onClose, guests = [], onGenerate }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return guests;
    const s = q.toLowerCase();
    return guests.filter(
      (g) =>
        g.guest.toLowerCase().includes(s) ||
        g.room.toLowerCase().includes(s) ||
        (g.folio || "").toLowerCase().includes(s)
    );
  }, [q, guests]);

  return (
    <Modal open={open} onClose={onClose} title="Huespedes para check-out" size="max-w-3xl">
      <div className="mb-2 flex items-center gap-2">
        <input
          className="border rounded px-2 py-1 w-full"
          placeholder="Buscar por huesped, habitacion o folio"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="px-2 py-1 rounded border" onClick={() => setQ("")}>Limpiar</button>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-auto">
        {filtered.map((g) => (
          <div key={g.folio} className="border rounded p-2 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{g.guest}  Hab. {g.room}</div>
              <div className="text-xs text-gray-500">
                Folio: {g.folio}  Noches: {g.nights}  Saldo:{" "}
                <strong className={g.balance > 0 ? "text-amber-700" : "text-green-700"}>
                  {fmtCurrency(g.balance, { symbol: "$", decimals: 2 })}
                </strong>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="px-2 py-1 rounded border text-xs"
                onClick={() =>
                  onGenerate({
                    guest: g.guest,
                    room: g.room,
                    items: [{ description: "Estancia / Consumos", qty: 1, price: g.balance }],
                    source: "checkout",
                  })
                }
              >
                Generar factura
              </button>
            </div>
          </div>
        ))}
        {!filtered.length && <div className="text-xs text-gray-500">Sin resultados.</div>}
      </div>
    </Modal>
  );
}

/** --- Pgina de Facturacin --- **/
export default function FacturacionPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const reservationIdFromUrl = searchParams.get("id");
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [preset, setPreset] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);

  // ====== CONFIGURACIN DESDE MANAGEMENT (mock; conctalo a tu backend) ======
  const management = {
    taxRate: 13, // % fijo definido en Management
    currency: {
      code: "CRC",   // Ej: "CRC" o "USD"
      symbol: "",   // Smbolo para UI
      decimals: 0,   // Colones usualmente sin decimales en caja (ajstalo a tu poltica)
    },
  };
  // ===========================================================================

  // Mtodos de pago desde Configuracin (mock; luego traer del backend/config)
  const paymentMethods = ["Efectivo", "Tarjeta", "Transferencia", "Sinpe", "Depsito"];

  // Mock de habitaciones en casa (ocupadas)
  const inHouseRooms = useMemo(
    () => [
      { room: "101", guest: "Ana Prez", balance: 120.0, folio: "FOL-101-A", nights: 2 },
      { room: "203", guest: "Luis Gmez", balance: 0.0, folio: "FOL-203-L", nights: 5 },
      { room: "305", guest: "Mara Ruiz", balance: 87.5, folio: "FOL-305-M", nights: 1 },
    ],
    []
  );

  // Mock de huespedes listos para check-out
  const checkoutGuests = useMemo(
    () => [
      { room: "101", guest: "Ana Prez", balance: 120.0, folio: "FOL-101-A", nights: 2 },
      { room: "204", guest: "Carlos Jimnez", balance: 45.0, folio: "FOL-204-C", nights: 3 },
      { room: "305", guest: "Mara Ruiz", balance: 87.5, folio: "FOL-305-M", nights: 1 },
    ],
    []
  );

  // Historial resumido para KPIs (podemos poblarlo luego desde backend)
  const [invoices, setInvoices] = useState([]);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = invoices.filter(i => i.date === today).length;
    const paid = invoices.filter(i => i.status === "Pagada").length;
    const pending = invoices.filter(i => i.status === "Pendiente" || i.status === "Parcial").length;
    const overdue = invoices.filter(i => i.status === "Vencida").length;
    return [
      { label: "Facturas hoy", value: todayCount },
      { label: "Pagadas", value: paid },
      { label: "Pendientes", value: pending },
      { label: "Vencidas", value: overdue },
    ];
  }, [invoices]);
  const kpiMap = useMemo(() => Object.fromEntries(kpis.map((k) => [k.label, k.value])), [kpis]);

  const filtered = useMemo(() => {
    if (!q.trim()) return invoices;
    const s = q.trim().toLowerCase();
    return invoices.filter(
      (i) =>
        (i.number && i.number.toLowerCase().includes(s)) ||
        (i.guest && i.guest.toLowerCase().includes(s)) ||
        (i.room && i.room.toLowerCase().includes(s))
    );
  }, [q, invoices]);

  // -------- Histórico de facturas (frontend) --------
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({
    dateFrom: "",
    dateTo: "",
    number: "",
    guest: "",
    room: "",
    status: "",
  });

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(historyFilters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });
      const { data } = await api.get(`/api/invoices?${params.toString()}`);
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      pushAlert({
        type: "system",
        title: "Error al cargar histórico",
        desc: "No se pudo cargar el histórico de facturas.",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const openNewInvoice = (presetData) => {
    setPreset(presetData || null);
    setShowNew(true);
  };

  const handleSaveInvoice = (payload) => {
    const nextNum = String(123 + invoices.length + 1).padStart(6, "0");
    const number = "F-" + nextNum;

    // TODO: guardar factura + auditora + eInvoice en backend
    // await api.post("/facturas", {...payload, number})
    // await api.post("/reportes/auditoria", payload.auditTrail)

    setInvoices((prev) => [{ ...payload, number, total: payload.totals.total }, ...prev]);
  };

  const openCheckoutList = () => setShowCheckout(true);

  const quickChargeFromRoom = (room) => {
    const items = [{ description: "Consumo / Estancia", qty: 1, price: Math.max(room.balance, 0) }];
    openNewInvoice({ guest: room.guest, room: room.room, items, source: "checkout" });
  };

  const goToCashClose = () =>
    pushAlert({
      type: "system",
      title: "Cierre de caja",
      desc: "Abrir flujo de Cierre de Caja (por implementar).",
    });
  const goToCreditNote = () =>
    pushAlert({
      type: "system",
      title: "Notas de crédito",
      desc: "Crear Nota de Crédito (por implementar).",
    });
  const goToDeposits = () =>
    pushAlert({
      type: "system",
      title: "Depósitos de adelantos",
      desc: "Depósitos de adelantos (por implementar).",
    });
  const goToHistory = () => {
    setShowHistory(true);
    loadHistory();
  };
  const [showBillingOverlay, setShowBillingOverlay] = useState(!!reservationIdFromUrl);

  const billingContent = (
    <div className="space-y-3">
      <div className="bg-white border rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Buscar por # de factura, huesped o habitacion"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="px-2 py-1 rounded border" onClick={() => setQ("")}>
            Limpiar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Factura</th>
                <th className="py-2 pr-3">Huesped</th>
                <th className="py-2 pr-3">Hab.</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Origen</th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.number || Math.random()} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium">{i.number ?? <Badge>nuevo</Badge>}</td>
                  <td className="py-2 pr-3">{i.guest}</td>
                  <td className="py-2 pr-3">{i.room || "-"}</td>
                  <td className="py-2 pr-3">{i.date}</td>
                  <td className="py-2 pr-3">{fmtCurrency(Number(i.total ?? 0), management.currency)}</td>
                  <td className="py-2 pr-3">
                    <Badge
                      color={
                        i.status === "Pagada"
                          ? "green"
                          : i.status === "Vencida"
                          ? "red"
                          : i.status === "Parcial"
                          ? "yellow"
                          : "gray"
                      }
                    >
                      {i.status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge color={i.source === "checkout" ? "blue" : "gray"}>{i.source}</Badge>
                  </td>
                  <td className="py-2 pr-2">
                    <button
                      className="px-2 py-1 rounded border"
                      onClick={() =>
                        openNewInvoice({
                          guest: i.guest,
                          room: i.room,
                          items: [{ description: "Ajuste", qty: 1, price: 0 }],
                          source: i.source,
                        })
                      }
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td className="py-6 text-center text-gray-500" colSpan={8}>
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Habitaciones en casa</h3>
          <span className="text-xs text-gray-500">{inHouseRooms.length} ocupadas</span>
        </div>
        <div className="space-y-2">
          {inHouseRooms.map((r) => (
            <div key={r.folio} className="border rounded p-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Hab. {r.room} {r.guest}</div>
                  <div className="text-xs text-gray-500">Noches: {r.nights} Folio: {r.folio}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">
                    Saldo:{" "}
                    <strong className={r.balance > 0 ? "text-amber-700" : "text-green-700"}>
                      {fmtCurrency(r.balance, management.currency)}
                    </strong>
                  </div>
                  <div className="mt-1 flex gap-1">
                    <button
                      className="px-2 py-1 rounded border text-xs"
                      onClick={() =>
                        openNewInvoice({
                          guest: r.guest,
                          room: r.room,
                          items: [{ description: "Consumo / Estancia", qty: 1, price: r.balance }],
                          source: "checkout",
                        })
                      }
                    >
                      Facturar
                    </button>
                    <button
                      className="px-2 py-1 rounded border text-xs"
                      onClick={() => quickChargeFromRoom(r)}
                      title="Cobro rapido con saldo sugerido"
                    >
                      Cobro rapido
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!inHouseRooms.length && <div className="text-xs text-gray-500">No hay habitaciones ocupadas.</div>}
        </div>
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1">Metodos de pago configurados</div>
          <div className="flex flex-wrap gap-1">
            {paymentMethods.map((m) => (
              <Badge key={m} color="gray">
                {m}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="p-4 min-h-screen text-sm"
      style={{ background: frontdeskTheme.background.app }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Facturacion</h1>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded bg-amber-600 text-white" onClick={goToCashClose}>
            Cierre de caja
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border bg-white p-3">
            <div className="text-lg font-semibold">{k.value}</div>
            <div className="text-xs text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Recuadros de accesos rapidos de facturacion */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          {
            title: "Resumen diario",
            desc: `Facturas hoy: ${kpiMap["Facturas hoy"] || 0}  Pagadas: ${kpiMap["Pagadas"] || 0}  Pendientes: ${kpiMap["Pendientes"] || 0}  Vencidas: ${kpiMap["Vencidas"] || 0}  Habitaciones en casa: ${inHouseRooms.length}`,
            action: () => {},
            cta: "Nueva factura",
            cta2: "Facturas de check-out",
          },
          { title: "Facturar", desc: "Crear factura inmediata", action: () => setShowBillingOverlay(true), cta: "Ir a facturacion" },
          { title: "Depositos de adelantos", desc: "Registrar anticipos y aplicarlos a facturas", action: goToDeposits, cta: "Ir a depositos" },
          { title: "Notas de credito", desc: "Emitir y consultar notas de credito", action: goToCreditNote, cta: "Crear nota" },
          { title: "Historico de facturas", desc: "Consultar facturas emitidas", action: goToHistory, cta: "Ver historico" },
        ].map((card) => (
          <div key={card.title} className="border rounded-lg bg-white p-4 flex flex-col gap-2 shadow-sm">
            <div className="text-sm font-semibold text-emerald-800">{card.title}</div>
            <div className="text-xs text-slate-600 flex-1">{card.desc}</div>
            <div className="flex gap-2 flex-wrap">
              <button
                className="px-3 py-1.5 text-xs rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 hover:bg-emerald-100"
                onClick={card.action}
              >
                {card.cta}
              </button>
              {card.cta2 && (
                <button
                  className="px-3 py-1.5 text-xs rounded-full bg-blue-50 text-blue-800 border border-blue-100 hover:bg-blue-100"
                  onClick={openCheckoutList}
                >
                  {card.cta2}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={showBillingOverlay}
        onClose={() => setShowBillingOverlay(false)}
        title="Facturacion"
        size="max-w-5xl"
      >
        {billingContent}
      </Modal>

      {/* Modal: Historico de facturas */}
      <Modal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        title="Historico de facturas"
        size="max-w-6xl"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
            <div className="flex flex-col gap-1">
              <span>Desde</span>
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={historyFilters.dateFrom}
                onChange={(e) =>
                  setHistoryFilters((f) => ({ ...f, dateFrom: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <span>Hasta</span>
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={historyFilters.dateTo}
                onChange={(e) =>
                  setHistoryFilters((f) => ({ ...f, dateTo: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <span># Factura</span>
              <input
                className="border rounded px-2 py-1"
                placeholder="Ej. F-000120"
                value={historyFilters.number}
                onChange={(e) =>
                  setHistoryFilters((f) => ({ ...f, number: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <span>Cliente</span>
              <input
                className="border rounded px-2 py-1"
                placeholder="Nombre o correo"
                value={historyFilters.guest}
                onChange={(e) =>
                  setHistoryFilters((f) => ({ ...f, guest: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <span>Habitacion</span>
              <input
                className="border rounded px-2 py-1"
                placeholder="Ej. 101"
                value={historyFilters.room}
                onChange={(e) =>
                  setHistoryFilters((f) => ({ ...f, room: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <select
              className="border rounded px-2 py-1"
              value={historyFilters.status}
              onChange={(e) =>
                setHistoryFilters((f) => ({ ...f, status: e.target.value }))
              }
            >
              <option value="">Todos los estados</option>
              <option value="ISSUED">Emitida</option>
              <option value="DRAFT">Borrador</option>
              <option value="CANCELED">Anulada</option>
              <option value="REFUNDED">Reembolsada</option>
            </select>
            <button
              type="button"
              className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs hover:bg-emerald-700"
              onClick={loadHistory}
              disabled={historyLoading}
            >
              {historyLoading ? "Buscando..." : "Aplicar filtros"}
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded-full border text-xs"
              onClick={() => {
                setHistoryFilters({
                  dateFrom: "",
                  dateTo: "",
                  number: "",
                  guest: "",
                  room: "",
                  status: "",
                });
                loadHistory();
              }}
            >
              Limpiar
            </button>
          </div>

          <div className="overflow-auto border rounded">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left">Fecha</th>
                  <th className="px-2 py-2 text-left"># Factura</th>
                  <th className="px-2 py-2 text-left">Cliente</th>
                  <th className="px-2 py-2 text-left">Habitacion</th>
                  <th className="px-2 py-2 text-left">Estado</th>
                  <th className="px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((inv) => {
                  const guestName =
                    `${inv.guest?.firstName || ""} ${inv.guest?.lastName || ""}`.trim() ||
                    inv.guest?.email ||
                    "-";
                  const roomLabel =
                    inv.reservation?.room?.number ||
                    inv.reservation?.room?.type ||
                    "";
                  const dateStr = inv.createdAt
                    ? new Date(inv.createdAt).toLocaleString()
                    : "";
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
                      <td className="px-2 py-1 text-right">
                        {fmtCurrency(inv.total, management.currency)}
                      </td>
                    </tr>
                  );
                })}
                {!historyItems.length && !historyLoading && (
                  <tr>
                    <td
                      className="px-2 py-4 text-center text-slate-500"
                      colSpan={6}
                    >
                      No hay facturas que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Modales */}
      <NewInvoiceModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSave={handleSaveInvoice}
        paymentMethods={paymentMethods}
        preset={preset}
        management={management}
      />

      <CheckoutGuestsModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        guests={checkoutGuests}
        onGenerate={(presetData) => {
          setShowCheckout(false);
          openNewInvoice(presetData);
        }}
      />
    </div>
  );
}









