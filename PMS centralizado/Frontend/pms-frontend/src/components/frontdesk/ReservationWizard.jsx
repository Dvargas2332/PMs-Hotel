import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import GuestPicker from "./GuestPicker";
import {
  User, Calendar, Bed, CreditCard, Tag, Utensils, FileText,
  ArrowRight, ArrowLeft, Check, Search, MapPin, ChevronDown
} from "lucide-react";

const STEPS = [
  { key: "guest", label: "Huésped", icon: User },
  { key: "room", label: "Habitación", icon: Bed },
  { key: "dates", label: "Fechas", icon: Calendar },
  { key: "details", label: "Detalles", icon: FileText },
];

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              active ? "bg-emerald-500 text-white shadow-sm" :
              done ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" :
              "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}>
              <s.icon size={13} />
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className="w-4 h-0.5 bg-slate-200 dark:bg-slate-700" />}
          </div>
        );
      })}
    </div>
  );
}

function RoomCard({ room, selected, disabled, onSelect }) {
  const statusColors = {
    AVAILABLE: "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10",
    OCCUPIED: "border-rose-200 bg-rose-50 dark:bg-rose-900/10",
    CLEANING: "border-amber-200 bg-amber-50 dark:bg-amber-900/10",
  };
  const color = statusColors[room.status] || "";

  return (
    <button
      type="button"
      disabled={disabled || room.status !== "AVAILABLE"}
      onClick={() => onSelect(room)}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        selected?.id === room.id
          ? "ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
          : disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-md " + color
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-lg font-bold" style={{ color: "var(--color-text-base)" }}>Hab. {room.number}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          room.status === "AVAILABLE" ? "bg-emerald-100 text-emerald-700" :
          room.status === "OCCUPIED" ? "bg-rose-100 text-rose-700" :
          "bg-amber-100 text-amber-700"
        }`}>
          {room.status === "AVAILABLE" ? "Libre" : room.status === "OCCUPIED" ? "Ocupada" : "Limpieza"}
        </span>
      </div>
      <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {room.type && <span>Tipo: {room.type}</span>}
        {room.baseRate && <span className="ml-2">· ₡{Number(room.baseRate).toLocaleString()}/noche</span>}
      </div>
    </button>
  );
}

export default function ReservationWizard({ onSave, onCancel }) {
  const [step, setStep] = useState(0);
  const [guest, setGuest] = useState(null);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [ratePlans, setRatePlans] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    checkInDate: new Date().toISOString().slice(0, 10),
    checkOutDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    adults: 2,
    children: 0,
    contractId: "",
    ratePlanId: "",
    mealPlanId: "",
    code: "",
    notes: "",
  });

  useEffect(() => {
    const load = async () => {
      const [roomsRes, contractsRes] = await Promise.all([
        api.get("/rooms"),
        api.get("/contracts"),
      ]);
      setRooms(roomsRes.data?.filter(r => !r.archived) || []);
      setContracts(contractsRes.data || []);
    };
    load();
  }, []);

  useEffect(() => {
    if (!form.contractId) { setRatePlans([]); return; }
    const contract = contracts.find(c => c.id === form.contractId);
    if (!contract) return;
    // Load rate plans from contract
    api.get("/ratePlans").then(({ data }) => {
      const rpList = Array.isArray(contract.ratePlans) ? contract.ratePlans.map(String) : [];
      setRatePlans((Array.isArray(data) ? data : []).filter(rp => rpList.includes(String(rp.id))));
    }).catch(() => setRatePlans([]));
  }, [form.contractId, contracts]);

  useEffect(() => {
    api.get("/mealPlans").then(({ data }) => {
      setMealPlans(Array.isArray(data) ? data : []);
    }).catch(() => setMealPlans([]));
  }, []);

  const nights = Math.max(1, Math.ceil(
    (new Date(form.checkOutDate).getTime() - new Date(form.checkInDate).getTime()) / 86400000
  ));

  const handleSubmit = async () => {
    if (!guest) return;
    if (!selectedRoom) return;
    if (!form.contractId || !form.ratePlanId) return;
    setSaving(true);
    try {
      await onSave({
        guestId: guest.id,
        roomId: selectedRoom.id,
        checkIn: form.checkInDate,
        checkOut: form.checkOutDate,
        adults: form.adults,
        children: form.children,
        contractId: form.contractId,
        ratePlanId: form.ratePlanId,
        mealPlanId: form.mealPlanId || undefined,
        code: form.code || undefined,
      });
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const canNext = () => {
    if (step === 0) return !!guest;
    if (step === 1) return !!selectedRoom;
    if (step === 2) return form.checkInDate && form.checkOutDate && form.checkInDate < form.checkOutDate;
    if (step === 3) return form.contractId && form.ratePlanId;
    return true;
  };

  return (
    <div className="space-y-4">
      <StepIndicator current={step} steps={STEPS} />

      {/* STEP 0: Guest */}
      {step === 0 && (
        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--color-text-base)" }}>
              <User size={18} className="text-emerald-500" /> Huésped
            </h3>
          </div>
          {guest ? (
            <div className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: "var(--card-border)", background: "var(--input-bg)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <User size={18} className="text-emerald-600" />
                </div>
                <div>
                  <div className="font-medium" style={{ color: "var(--color-text-base)" }}>{guest.firstName} {guest.lastName}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {[guest.email, guest.phone].filter(Boolean).join(" · ") || "Sin contacto"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setGuest(null); setShowGuestPicker(true); }}
                className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{ borderColor: "var(--card-border)", color: "var(--color-text-muted)" }}
              >
                Cambiar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowGuestPicker(true)}
              className="w-full py-10 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all"
              style={{ borderColor: "var(--card-border)" }}
            >
              <Search size={28} className="opacity-30" />
              <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Buscar o crear huésped</span>
            </button>
          )}
          <GuestPicker
            isOpen={showGuestPicker}
            onClose={() => setShowGuestPicker(false)}
            onSelect={(g) => { setGuest(g); setShowGuestPicker(false); }}
          />
        </div>
      )}

      {/* STEP 1: Room */}
      {step === 1 && (
        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
          <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--color-text-base)" }}>
            <Bed size={18} className="text-blue-500" /> Seleccionar habitación
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
            {rooms.map(room => (
              <RoomCard
                key={room.id}
                room={room}
                selected={selectedRoom}
                disabled={false}
                onSelect={setSelectedRoom}
              />
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Dates */}
      {step === 2 && (
        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
          <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--color-text-base)" }}>
            <Calendar size={18} className="text-amber-500" /> Fechas de estancia
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-muted)" }}>Check-in</label>
              <input
                type="date"
                value={form.checkInDate}
                onChange={e => setForm(f => ({ ...f, checkInDate: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-muted)" }}>Check-out</label>
              <input
                type="date"
                value={form.checkOutDate}
                onChange={e => setForm(f => ({ ...f, checkOutDate: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
              />
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded-lg" style={{ background: "var(--input-bg)", color: "var(--color-text-muted)" }}>
              <strong style={{ color: "var(--color-text-base)" }}>{nights}</strong> {nights === 1 ? "noche" : "noches"}
            </span>
            <span className="px-2 py-1 rounded-lg" style={{ background: "var(--input-bg)", color: "var(--color-text-muted)" }}>
              Huéspedes: <strong style={{ color: "var(--color-text-base)" }}>{form.adults}</strong>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-muted)" }}>Adultos</label>
              <input type="number" min={1} max={10} value={form.adults}
                onChange={e => setForm(f => ({ ...f, adults: Number(e.target.value) }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--color-text-muted)" }}>Niños</label>
              <input type="number" min={0} max={10} value={form.children}
                onChange={e => setForm(f => ({ ...f, children: Number(e.target.value) }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Details */}
      {step === 3 && (
        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
          <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--color-text-base)" }}>
            <FileText size={18} className="text-purple-500" /> Detalles de la reserva
          </h3>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl" style={{ background: "var(--input-bg)" }}>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Huésped: <strong style={{ color: "var(--color-text-base)" }}>{guest?.firstName} {guest?.lastName}</strong>
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Habitación: <strong style={{ color: "var(--color-text-base)" }}>{selectedRoom?.number}</strong>
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Entrada: <strong style={{ color: "var(--color-text-base)" }}>{form.checkInDate}</strong>
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Salida: <strong style={{ color: "var(--color-text-base)" }}>{form.checkOutDate}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                <Tag size={12} /> Contrato *
              </label>
              <select
                value={form.contractId}
                onChange={e => setForm(f => ({ ...f, contractId: e.target.value, ratePlanId: "" }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
              >
                <option value="">Seleccionar contrato...</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                <CreditCard size={12} /> Tarifario *
              </label>
              <select
                value={form.ratePlanId}
                onChange={e => setForm(f => ({ ...f, ratePlanId: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
                disabled={!form.contractId}
              >
                <option value="">Seleccionar tarifa...</option>
                {ratePlans.map(rp => <option key={rp.id} value={rp.id}>{rp.name} — {rp.currency} {Number(rp.price).toLocaleString()}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                <Utensils size={12} /> Plan de comidas
              </label>
              <select
                value={form.mealPlanId}
                onChange={e => setForm(f => ({ ...f, mealPlanId: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
              >
                <option value="">Sin plan</option>
                {mealPlans.map(mp => <option key={mp.id} value={mp.id}>{mp.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>
                <Hash size={12} /> Código (opcional)
              </label>
              <input
                type="text"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="Auto-generado si vacío"
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={step === 0 ? onCancel : () => setStep(s => s - 1)}
          className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
          style={{ borderColor: "var(--card-border)", color: "var(--color-text-base)" }}
        >
          <ArrowLeft size={15} />
          {step === 0 ? "Cancelar" : "Atrás"}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1.5"
          >
            Siguiente <ArrowRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canNext() || saving}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check size={16} />
            {saving ? "Creando..." : "Crear Reserva"}
          </button>
        )}
      </div>
    </div>
  );
}
