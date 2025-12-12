import React, { useEffect, useMemo, useState } from "react";
import { useHotelData } from "../../context/HotelDataContext";
import { api } from "../../lib/api";
import { pushAlert } from "../../lib/uiAlerts";

const STATUS_META = {
  Confirmada: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  Pendiente: { bg: "bg-amber-100 text-amber-800 border-amber-200" },
  "Check-in": { bg: "bg-blue-100 text-blue-800 border-blue-200" },
  "Check-out": { bg: "bg-slate-100 text-slate-800 border-slate-200" },
  Cancelada: { bg: "bg-rose-100 text-rose-800 border-rose-200" },
  CONFIRMED: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  PENDING: { bg: "bg-amber-100 text-amber-800 border-amber-200" },
  CHECKED_IN: { bg: "bg-blue-100 text-blue-800 border-blue-200" },
  CHECKED_OUT: { bg: "bg-slate-100 text-slate-800 border-slate-200" },
  CANCELED: { bg: "bg-rose-100 text-rose-800 border-rose-200" },
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { bg: "bg-gray-100 text-gray-700 border-gray-200" };
  return <span className={`px-2 py-1 rounded border text-xs font-medium ${meta.bg}`}>{status || "N/D"}</span>;
};

const emptyForm = {
  guestId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  roomId: "",
  checkInDate: "",
  checkOutDate: "",
  adults: 2,
  children: 0,
  infants: 0,
  quantity: 1,
  ratePlanId: "",
  price: "",
  currency: "CRC",
  source: "FRONTDESK",
  channel: "DIRECT",
  status: "CONFIRMED",
  paymentMethod: "",
  depositAmount: "",
  otaCode: "",
  code: "",
  rooming: "",
  mealPlanId: "",
  hotelId: "",
  discount: "",
  priceRoom: "",
  priceNet: "",
  priceRegimen: "",
  priceTax: "",
};

function ActionButton({ onClick, children, disabled, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200",
    green: "bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-600",
    blue: "bg-blue-600 text-white hover:bg-blue-500 border-blue-600",
    red: "bg-rose-600 text-white hover:bg-rose-500 border-rose-600",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded text-xs border transition ${tones[tone]} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

export default function ReservationsPage() {
  const {
    reservations,
    rooms,
    guests,
    loading,
    refreshReservations,
    refreshRooms,
    refreshGuests,
    createReservation,
    doCheckIn,
    doCheckOut,
    cancelReservation,
    createGuest,
    setReservations,
  } = useHotelData();

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [ratePlans, setRatePlans] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [showRowEditor, setShowRowEditor] = useState(false);
  const [rowSaved, setRowSaved] = useState(false);
  const [rowConfirmed, setRowConfirmed] = useState(false);
  const [draftRows, setDraftRows] = useState([]);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [guestQuery, setGuestQuery] = useState("");
  const [guestType, setGuestType] = useState("PERSON"); // PERSON | COMPANY

  const currentPlan = useMemo(
    () => ratePlans.find((r) => String(r.id) === String(form.ratePlanId)),
    [ratePlans, form.ratePlanId]
  );
  const isAgencyPlan = useMemo(() => {
    const txt = (currentPlan?.channel || currentPlan?.type || currentPlan?.name || "").toUpperCase();
    return txt.includes("AGENC");
  }, [currentPlan]);

  const handleDateFrom = (v) => {
    const parseLocal = (s) => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let value = v;
    if (value) {
      const chosen = parseLocal(value);
      if (chosen < today) {
        // Forzar "Desde" a hoy si el usuario elige una fecha pasada
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        value = `${y}-${m}-${d}`;
        pushAlert({
          type: "system",
          title: "Fecha Desde inválida",
          desc: "La fecha Desde no puede ser menor al día en curso.",
        });
      }
    }

    setForm((f) => {
      const next = { ...f, checkInDate: value };
      if (value) {
        const base = parseLocal(value);
        base.setDate(base.getDate() + 1);
        const y = base.getFullYear();
        const m = String(base.getMonth() + 1).padStart(2, "0");
        const d = String(base.getDate()).padStart(2, "0");
        next.checkOutDate = `${y}-${m}-${d}`;
      } else {
        next.checkOutDate = "";
      }
      return next;
    });
  };

  // Ajustar precio segun tarifario / habitacion
  useEffect(() => {
    if (!form.roomId && !form.ratePlanId) return;
    const room = rooms.find((r) => String(r.id) === String(form.roomId));
    const plan = ratePlans.find((r) => String(r.id) === String(form.ratePlanId));
    const baseRoom =
      (typeof plan?.priceWithoutTax === "number" && plan.priceWithoutTax) ||
      (typeof plan?.amount === "number" && plan.amount) ||
      (typeof room?.baseRate === "number" && room.baseRate) ||
      (typeof plan?.price === "number" && plan.price) ||
      0;
    const regimenAmount =
      (typeof plan?.mealplants === "number" && plan.mealplants) ||
      (typeof plan?.mealsplant === "number" && plan.mealsplant) ||
      (typeof plan?.mealsPlan === "number" && plan.mealsPlan) ||
      (typeof plan?.regimenPrice === "number" && plan.regimenPrice) ||
      (typeof plan?.regimenAmount === "number" && plan.regimenAmount) ||
      0;
    const taxAmount =
      (typeof plan?.taxes === "number" && plan.taxes) ||
      (typeof plan?.taxAmount === "number" && plan.taxAmount) ||
      (typeof plan?.iva === "number" && plan.iva) ||
      0;
    setForm((f) => ({
      ...f,
      priceRoom: baseRoom,
      priceRegimen: regimenAmount,
      priceTax: taxAmount,
    }));
  }, [form.roomId, form.ratePlanId, rooms, ratePlans]);

  // Codigo (todas las reservas) y rooming (solo agencias) consecutivos
  useEffect(() => {
    setForm((f) => {
      const next = { ...f };
      if (!f.code) {
        next.code = `RES-${String((reservations?.length || 0) + (draftRows?.length || 0) + 1).padStart(6, "0")}`;
      }
      if (isAgencyPlan && !f.rooming) {
        next.rooming = `AG-RM-${String((reservations?.length || 0) + (draftRows?.length || 0) + 1).padStart(4, "0")}`;
      }
      return next;
    });
  }, [isAgencyPlan, reservations?.length, draftRows?.length]);

  // Ajustar total con desglose (sin iva ni regimen en priceRoom, regimen en priceRegimen, impuesto en priceTax, descuento en discount)
  useEffect(() => {
    setForm((f) => {
      const room = Number(f.priceRoom) || 0;
      const reg = Number(f.priceRegimen) || 0;
      const disc = Number(f.discount) || 0;
      let tax = Number(f.priceTax) || 0;
      if (!tax && f.price) {
        const remainder = Number(f.price) - room - reg + disc;
        if (!Number.isNaN(remainder) && remainder >= 0) tax = remainder;
      }
      const total = room + reg + tax - disc;
      if (total === Number(f.price) && tax === Number(f.priceTax)) return f;
      return { ...f, price: total, priceTax: tax };
    });
  }, [form.priceRoom, form.priceRegimen, form.priceTax, form.discount, form.price]);

  const handleDateTo = (v) => {
    const parseLocal = (s) => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    };

    setForm((f) => {
      if (f.checkInDate) {
        const from = parseLocal(f.checkInDate);
        const min = new Date(from);
        min.setDate(min.getDate() + 1);

        const y = min.getFullYear();
        const m = String(min.getMonth() + 1).padStart(2, "0");
        const d = String(min.getDate()).padStart(2, "0");
        const minStr = `${y}-${m}-${d}`;

        // Si el usuario elige una fecha menor o igual a "Desde", forzar siempre al día siguiente
        if (!v || parseLocal(v) <= from) {
          pushAlert({
            type: "system",
            title: "Fecha Hasta inválida",
            desc: "La fecha Hasta debe ser al menos un día después de Desde.",
          });
          return { ...f, checkOutDate: minStr };
        }
        return { ...f, checkOutDate: v };
      }
      // Si aún no hay "Desde", simplemente guardamos lo seleccionado
      return { ...f, checkOutDate: v };
    });
  };

  const handleDepositClick = () => {
    const current = form.depositAmount ? String(form.depositAmount) : "";
    const input = window.prompt("Deposito de confirmacion", current);
    if (input === null) return;
    const num = input === "" ? "" : Number(input);
    if (Number.isNaN(num)) {
      pushAlert({ type: "system", title: "Monto invalido", desc: "Revisa el monto de deposito ingresado." });
      return;
    }
    setForm((f) => ({ ...f, depositAmount: input === "" ? "" : num }));
  };

  useEffect(() => {
    refreshRooms();
    refreshGuests();
    refreshReservations();
    api
      .get("/api/ratePlans")
      .then(({ data }) => {
        if (Array.isArray(data)) setRatePlans(data);
      })
      .catch(() => {});
    api
      .get("/api/mealPlans")
      .then(({ data }) => {
        if (Array.isArray(data)) setMealPlans(data);
      })
      .catch(() => {});
  }, [refreshRooms, refreshGuests, refreshReservations]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = reservations.filter((r) => (r.rawStatus || "").toUpperCase() !== "CANCELED");
    return visible.filter((r) => {
      const matchesSearch =
        !term ||
        (r.guestName || "").toLowerCase().includes(term) ||
        (r.code || "").toLowerCase().includes(term) ||
        (r.roomNumber || "").toLowerCase().includes(term);
      return matchesSearch;
    });
  }, [reservations, search]);

  const buildGuest = async (row) => {
    let guestId = row.guestId;
    if (!guestId) {
      if (!row.firstName || !row.lastName) {
        throw new Error("Completa nombre y apellido del huesped");
      }
      const guest = await createGuest({
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email || undefined,
        phone: row.phone || undefined,
      });
      guestId = guest?.id;
    }
    return guestId;
  };

  const createReservationFromRow = async (row) => {
    const toISODate = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(`${dateStr}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? dateStr : d.toISOString();
    };
    const guestId = await buildGuest(row);
    return createReservation({
      roomId: row.roomId,
      guestId,
      checkInDate: toISODate(row.checkInDate),
      checkOutDate: toISODate(row.checkOutDate),
      adults: Number(row.adults) || 2,
      children: Number(row.children) || 0,
      infants: Number(row.infants) || 0,
      quantity: Number(row.quantity) || 1,
      ratePlanId: row.ratePlanId || undefined,
      mealPlanId: row.mealPlanId || undefined,
      price: row.price || undefined,
      priceRoom: row.priceRoom || undefined,
      priceRegimen: row.priceRegimen || undefined,
      priceTax: row.priceTax || undefined,
      discount: row.discount || undefined,
      currency: row.currency || "CRC",
      source: row.source || "FRONTDESK",
      channel: row.channel || "DIRECT",
      status: showRowEditor ? "PENDING" : row.status || "CONFIRMED",
      paymentMethod: row.paymentMethod || undefined,
      depositAmount: row.depositAmount || undefined,
      otaCode: row.otaCode || undefined,
      rooming: row.rooming || undefined,
      code: row.code || undefined,
      hotelId: row.hotelId || undefined,
    });
  };

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    const rowsToSave = draftRows.length ? draftRows : [form];
    for (const r of rowsToSave) {
      if (!r.roomId || !r.checkInDate || !r.checkOutDate) {
        pushAlert({
          type: "system",
          title: "Datos incompletos",
          desc: "Completa habitacion y rango de fechas antes de guardar la reserva.",
        });
        return;
      }
      if (r.checkOutDate <= r.checkInDate) {
        pushAlert({
          type: "system",
          title: "Fechas invalidas",
          desc: "La fecha de salida debe ser despues de la entrada.",
        });
        return;
      }
    }
    try {
      setCreating(true);
      let lastId = null;
      for (const row of rowsToSave) {
        const created = await createReservationFromRow(row);
        if (created?.id) lastId = created.id;
      }
      if (lastId) setSelectedRow(lastId);
      setDraftRows([]);
      await refreshReservations();
      await refreshRooms();
      setRowSaved(false);
      setRowConfirmed(false);
      setForm((f) => ({ ...emptyForm, ratePlanId: f.ratePlanId }));
      setSearch("");
      setShowRowEditor(false);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo crear la reserva";
      pushAlert({ type: "system", title: "Error al crear reserva", desc: msg });
    } finally {
      setCreating(false);
    }
  };

  const handleSaveRow = () => {
    if (!form.roomId || !form.checkInDate || !form.checkOutDate) {
      pushAlert({
        type: "system",
        title: "Datos incompletos",
        desc: "Completa habitacion y rango de fechas antes de guardar la fila.",
      });
      return;
    }
    if (form.checkOutDate <= form.checkInDate) {
      pushAlert({
        type: "system",
        title: "Fechas invalidas",
        desc: "La fecha de salida debe ser despues de la entrada.",
      });
      return;
    }
    // Mantener datos de huesped para todas las filas; solo limpiamos campos de habitacion al seguir creando
    setDraftRows((rows) => [...rows, { ...form }]);
    setRowSaved(true);
    setShowRowEditor(false);
    setForm((f) => ({
      ...f,
      roomId: "",
      ratePlanId: f.ratePlanId,
      mealPlanId: "",
      quantity: 1,
      adults: 2,
      children: 0,
      infants: 0,
      price: "",
      priceRoom: "",
      priceNet: "",
      priceRegimen: "",
      priceTax: "",
    }));
  };

  const canCheckIn = (r) => {
    const code = (r.rawStatus || "").toUpperCase();
    return code === "CONFIRMED" || code === "PENDING";
  };
  const canCheckOut = (r) => (r.rawStatus || "").toUpperCase() === "CHECKED_IN";
  const canCancel = (r) => {
    const code = (r.rawStatus || "").toUpperCase();
    return code !== "CANCELED" && code !== "CHECKED_OUT";
  };

  const resetForm = () => {
    setForm((f) => ({ ...emptyForm, ratePlanId: f.ratePlanId }));
    setSelectedRow(null);
  };

  const loadReservation = (r) => {
    if (!r) return;
    setSelectedRow(r.id);
    setShowRowEditor(true);
    setForm({
      ...form,
      guestId: r.guestId || "",
      firstName: r.guest?.firstName || "",
      lastName: r.guest?.lastName || "",
      email: r.guest?.email || "",
      phone: r.guest?.phone || "",
      roomId: r.roomId || "",
      checkInDate: r.checkInDate || "",
      checkOutDate: r.checkOutDate || "",
      adults: r.adults || 2,
      children: r.children || 0,
      ratePlanId: r.ratePlanId || "",
      mealPlanId: r.mealPlanId || form.mealPlanId || "",
      price: r.price || 0,
      otaCode: r.otaCode || form.otaCode || "",
      currency: r.currency || "CRC",
      source: r.source || "FRONTDESK",
      channel: r.channel || "DIRECT",
      status: r.rawStatus || "CONFIRMED",
      paymentMethod: r.paymentMethod || "",
      depositAmount: r.depositAmount || "",
      code: r.code || "",
      rooming: r.rooming || form.rooming || (isAgencyPlan ? `AG-RM-${String((reservations?.length || 0) + (draftRows?.length || 0) + 1).padStart(4, "0")}` : ""),
      hotelId: r.hotelId || "",
      discount: r.discount || "",
      quantity: r.quantity || 1,
      infants: r.infants || 0,
      priceRoom: r.priceRoom ?? r.room?.baseRate ?? form.priceRoom ?? 0,
      priceRegimen:
        r.priceRegimen ??
        r.ratePlan?.mealplants ??
        r.ratePlan?.mealsplant ??
        r.ratePlan?.mealsPlan ??
        r.ratePlan?.regimenPrice ??
        r.ratePlan?.regimenAmount ??
        0,
      priceTax:
        r.priceTax ??
        r.ratePlan?.taxes ??
        r.ratePlan?.taxAmount ??
        r.ratePlan?.iva ??
        (() => {
          const room = Number(r.priceRoom ?? r.room?.baseRate ?? 0) || 0;
          const reg =
            Number(
              r.priceRegimen ??
                r.ratePlan?.mealsplant ??
                r.ratePlan?.mealsPlan ??
                r.ratePlan?.regimenPrice ??
                r.ratePlan?.regimenAmount ??
                0
            ) || 0;
          const disc = Number(r.discount ?? 0) || 0;
          const price = Number(r.price ?? 0) || 0;
          const calc = price - room - reg + disc;
          return calc > 0 ? calc : 0;
        })(),
    });
  };

  const handleEmail = () => {
    if (!form.email) {
      pushAlert({
        type: "payment",
        title: "Sin correo de contacto",
        desc: "Agrega un correo electronico del huesped para poder enviar la reserva.",
      });
      return;
    }
    const subject = encodeURIComponent(`Reserva ${form.code || ""}`);
    const body = encodeURIComponent("Detalle de su reserva adjunto.");
    window.location.href = `mailto:${form.email}?subject=${subject}&body=${body}`;
  };

  const handleWhatsapp = () => {
    const phone = (form.phone || "").replace(/\D/g, "");
    if (!phone) {
      pushAlert({
        type: "payment",
        title: "Sin telefono",
        desc: "Agrega un numero de telefono para enviar la informacion por WhatsApp.",
      });
      return;
    }
    window.open(`https://wa.me/${phone}`, "_blank", "noopener");
  };

  const handlePrint = () => window.print();

  const handleNameChange = (value) => {
    const parts = value.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");
    setForm((f) => ({ ...f, firstName, lastName }));
  };

  const handlePickProfile = () => {
    if (!guests || !guests.length) {
      refreshGuests();
    }
    setGuestQuery("");
    setGuestType("PERSON");
    setShowGuestPicker(true);
  };

  const filteredGuests = useMemo(() => {
    const term = guestQuery.trim().toLowerCase();
    return (guests || []).filter((g) => {
      const isCompany = !!g.company;
      if (guestType === "PERSON" && isCompany) return false;
      if (guestType === "COMPANY" && !isCompany) return false;

      if (!term) return true;
      const fullName = `${g.firstName || ""} ${g.lastName || ""}`.toLowerCase();
      return (
        fullName.includes(term) ||
        (g.email || "").toLowerCase().includes(term) ||
        (g.phone || "").toLowerCase().includes(term) ||
        (g.company || "").toLowerCase().includes(term) ||
        (g.idNumber || "").toLowerCase().includes(term)
      );
    });
  }, [guestQuery, guests, guestType]);

  // Habitaciones agrupadas por tipo para el selector
  const roomsByType = useMemo(() => {
    const map = new Map();
    (rooms || []).forEach((r) => {
      const key = r.type || "Sin tipo";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return Array.from(map.entries());
  }, [rooms]);

  const selectGuest = (g) => {
    setForm((f) => ({
      ...f,
      guestId: g.id || "",
      firstName: g.firstName || "",
      lastName: g.lastName || "",
      email: g.email || "",
      phone: g.phone || "",
    }));
    setShowGuestPicker(false);
  };

  const handleConfirmAction = async () => {
    const selected = reservations.find((r) => r.id === selectedRow);
    if (selected) {
      setRowConfirmed(true);
      setReservations((list) =>
        list.map((r) => (r.id === selectedRow ? { ...r, rawStatus: "CONFIRMED", status: "Confirmada" } : r))
      );
      await refreshReservations();
      return;
    }
    await handleCreate();
    setRowConfirmed(true);
  };

  const handleCancelAction = () => {
    const selected = reservations.find((r) => r.id === selectedRow);
    if (selected && canCancel(selected)) {
      const ok = window.confirm("Seguro que deseas anular esta reserva?");
      if (!ok) return;
      const reason = window.prompt("Motivo de anulacion:", "");
      if (reason === null || reason.trim() === "") return;
      cancelReservation(selectedRow, { reason });
      setSelectedRow(null);
      refreshReservations();
      return;
    }
    resetForm();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reservas</h1>
          <p className="text-sm text-slate-600">Diseno tipo maqueta para captura rapida.</p>
        </div>
        <div className="flex gap-2 items-end">
          <PillInput
            label="Busqueda"
            value={search}
            onChange={setSearch}
            placeholder="Huesped / codigo / habitacion"
            containerClassName="min-w-[220px]"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Sidebar de reservas creadas */}
        <div className="w-full lg:w-64 rounded-2xl border bg-white shadow-sm p-3 space-y-2">
          <div className="text-sm font-semibold text-slate-800">Reservas creadas</div>
          <div className="space-y-1 max-h-[400px] overflow-auto">
            {filtered.map((r) => (
              <button
                key={r.id}
                className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${
                  selectedRow === r.id ? "bg-emerald-50 border-emerald-200" : "bg-white hover:bg-slate-50"
                }`}
                onClick={() => {
                  setSelectedRow(r.id);
                  loadReservation(r);
                }}
              >
                <div className="font-semibold">{r.code || r.id}</div>
                <div className="text-xs text-slate-600">
                  {r.guestName || `${r.guest?.firstName || ""} ${r.guest?.lastName || ""}`.trim() || "Sin nombre"}
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-xs text-slate-500">Sin reservas para listar.</div>}
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 space-y-4">
          <div className="rounded-2xl border bg-white shadow-sm p-4 space-y-5">
            {/* Top layout */}
            <div className="flex flex-col xl:flex-row gap-4">
              {/* Izquierda */}
              <div className="flex-1 space-y-2">
                <PillInput
                  label="ID - OTAS"
                  value={form.otaCode}
                  onChange={(v) => setForm((f) => ({ ...f, otaCode: v }))}
                  inputClassName="max-w-[160px]"
                  containerClassName="max-w-[200px]"
                />
                <PillSelect
                  label="Tarifario"
                  value={form.ratePlanId}
                  onChange={(v) => setForm((f) => ({ ...f, ratePlanId: v }))}
                  options={[{ label: "N/A", value: "" }, ...ratePlans.map((r) => ({ label: r.name, value: r.id }))]}
                  selectClassName="max-w-[200px]"
                />
                <div className="flex items-end gap-[3px]">
                  <PillInput
                    label="Desde"
                    type="date"
                    value={form.checkInDate}
                    onChange={handleDateFrom}
                    containerClassName="max-w-[120px]"
                    pillClassName={rowSaved ? "bg-slate-100 opacity-80" : ""}
                    disabled={rowSaved}
                  />
                  <div className="h-10 w-px bg-slate-300 rounded-full" />
                  <PillInput
                    label="Hasta"
                    type="date"
                    value={form.checkOutDate}
                    onChange={handleDateTo}
                    min={form.checkInDate ? (() => {
                      const d = new Date(form.checkInDate);
                      d.setDate(d.getDate() + 1);
                      return d.toISOString().slice(0, 10);
                    })() : undefined}
                    containerClassName="max-w-[120px]"
                    pillClassName={rowSaved ? "bg-slate-100 opacity-80" : ""}
                    disabled={rowSaved}
                  />
                </div>
                <div className="flex flex-col gap-1 text-xs text-slate-600 max-w-[200px]">
                  <span>Deposito de confirmacion</span>
                  <button
                    type="button"
                    onClick={handleDepositClick}
                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800 hover:bg-slate-200 text-left"
                  >
                    {form.depositAmount ? `CRC ${form.depositAmount}` : "Asignar deposito"}
                  </button>
                </div>
                <PillInput
                  label="Descuento"
                  value={form.discount}
                  onChange={(v) => setForm((f) => ({ ...f, discount: v }))}
                  inputClassName="max-w-[200px]"
                  containerClassName="max-w-[200px]"
                />
              </div>

              <div className="hidden xl:block w-px bg-slate-200" />

              {/* Centro */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <PillInput
                    label="ID - reservas"
                    value={form.code}
                    onChange={(v) => setForm((f) => ({ ...f, code: v }))}
                    disabled
                    containerClassName="max-w-[110px]"
                  />
                  <PillInput
                    label="Rooming"
                    value={form.rooming}
                    onChange={(v) => setForm((f) => ({ ...f, rooming: v }))}
                    disabled
                    containerClassName="max-w-[110px]"
                  />
                </div>
                <div className="space-y-2 max-w-[620px]">
                  <div className="flex items-end gap-3">
                    <PillInput
                      label="Nombre completo"
                      value={`${form.firstName} ${form.lastName}`.trim()}
                      onChange={handleNameChange}
                      placeholder="Selecciona un perfil o escribe un nombre"
                      containerClassName="flex-1 max-w-[350px]"
                    />
                    <PillButton label="Perfiles: agregar" onClick={handlePickProfile} />
                  </div>
                  <PillInput
                    label="Correo electronico"
                    value={form.email}
                    onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                    placeholder="Escribir texto"
                    containerClassName="max-w-[350px]"
                  />
                  <PillInput
                    label="Numero de telefono"
                    value={form.phone}
                    onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                    placeholder="Escribir texto"
                    prefix="+"
                    containerClassName="max-w-[220px]"
                  />
                </div>
                <div className="text-xs text-slate-500">Fecha y usuario que creo la reserva</div>
              </div>

              {/* Derecha */}
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <PillInput
                    label="Nombre de tarjeta"
                    value={form.paymentMethod}
                    onChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}
                    placeholder="Nombre de tarjeta de credito"
                  />
                  <PillInput
                    label="Numero de tarjeta"
                    value={form.currency}
                    onChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                    placeholder="Numero de tarjeta de credito"
                  />
                </div>
              </div>
            </div>

            {/* Tabla estilo maqueta unida al bloque superior */}
            <div className="border-t border-emerald-100 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-emerald-800">
                <div className="text-xs font-semibold">Seccion de habitaciones</div>
                <div className="flex gap-2 flex-wrap">
                  <PillButton
                    label="Crear"
                    onClick={() => {
                      setShowRowEditor(true);
                      if (rowSaved) {
                        setSelectedRow(null);
                      }
                      setRowSaved(false);
                      setRowConfirmed(false);
                    }}
                    disabled={creating}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-slate-200">
                  <thead className="text-xs uppercase text-slate-600 bg-emerald-50">
                    <tr>
                      <th className="px-2 py-1 border-x border-slate-200">Cantidad</th>
                      <th className="px-2 py-1 border-x border-slate-200">Tipo de habitacion</th>
                      <th className="px-2 py-1 border-x border-slate-200">Regimen</th>
                      <th className="px-2 py-1 border-x border-slate-200">Adultos</th>
                      <th className="px-2 py-1 border-x border-slate-200">Ninos</th>
                      <th className="px-2 py-1 border-x border-slate-200">Bebes</th>
                      <th className="px-2 py-1 border-x border-slate-200">Precio + IVA</th>
                      <th className="px-2 py-1 border-x border-slate-200">Habitacion</th>
                      <th className="px-2 py-1 border-x border-slate-200">Estado</th>
                      <th className="px-2 py-1 text-right border-x border-slate-200">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showRowEditor && (
                      <tr className="border-t border-slate-200 bg-emerald-50">
                        <td className="px-2 py-2 text-center border-x border-slate-200">
                          <input
                            type="number"
                            min="1"
                            className="w-14 rounded border px-2 py-1 text-sm"
                            value={form.quantity || 1}
                            onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) || 1 }))}
                            disabled={rowSaved}
                          />
                        </td>
                        <td className="px-2 py-2 border-x border-slate-200">
                          <select
                            className="w-full rounded border px-2 py-1 text-sm"
                            value={form.roomId}
                            onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                            disabled={rowSaved}
                          >
                            <option value="">Seleccione</option>
                            {roomsByType.map(([type, list]) => (
                              <optgroup key={type} label={type}>
                                {list.map((room) => (
                                  <option key={room.id} value={room.id}>
                                    {room.number ? `Hab. ${room.number}` : room.name || `ID ${room.id}`}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 border-x border-slate-200">
                          <select
                            className="w-full rounded border px-2 py-1 text-sm"
                            value={form.mealPlanId}
                            onChange={(e) => setForm((f) => ({ ...f, mealPlanId: e.target.value }))}
                            disabled={rowSaved}
                          >
                            <option value="">Seleccione</option>
                            {mealPlans.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-center border-x border-slate-200">
                          <input
                            type="number"
                            min="1"
                            className="w-14 rounded border px-2 py-1 text-sm"
                            value={form.adults}
                            onChange={(e) => setForm((f) => ({ ...f, adults: Number(e.target.value) || 1 }))}
                            disabled={rowSaved}
                          />
                        </td>
                        <td className="px-2 py-2 text-center border-x border-slate-200">
                          <input
                            type="number"
                            min="0"
                            className="w-14 rounded border px-2 py-1 text-sm"
                            value={form.children}
                            onChange={(e) => setForm((f) => ({ ...f, children: Number(e.target.value) || 0 }))}
                            disabled={rowSaved}
                          />
                        </td>
                        <td className="px-2 py-2 text-center border-x border-slate-200">
                          <input
                            type="number"
                            min="0"
                            className="w-14 rounded border px-2 py-1 text-sm"
                            value={form.infants}
                            onChange={(e) => setForm((f) => ({ ...f, infants: Number(e.target.value) || 0 }))}
                            disabled={rowSaved}
                          />
                        </td>
                        <td className="px-2 py-2 text-right border-x border-slate-200">
                          <span className="font-semibold text-emerald-700">{form.price ? `CRC ${form.price}` : "-"}</span>
                        </td>
                        <td className="px-2 py-2 border-x border-slate-200">
                          <input
                            type="text"
                            className="w-28 rounded border px-2 py-1 text-sm"
                            value={
                              rooms.find((r) => String(r.id) === String(form.roomId))?.number ||
                              rooms.find((r) => String(r.id) === String(form.roomId))?.name ||
                              form.roomId
                            }
                            readOnly
                            disabled={rowSaved}
                          />
                        </td>
                        <td className="px-2 py-2">
                          {rowConfirmed ? <StatusBadge status="CONFIRMED" /> : <span className="text-xs text-slate-400"></span>}
                        </td>
                        <td className="px-2 py-2 text-right space-x-1 border-x border-slate-200">
                          <ActionButton tone="green" disabled={creating || rowSaved} onClick={handleSaveRow}>
                            Guardar fila
                          </ActionButton>
                          <ActionButton
                            tone="blue"
                            disabled={!rowSaved}
                            onClick={() => {
                              setRowSaved(false);
                              setRowConfirmed(false);
                            }}
                          >
                            Editar fila
                          </ActionButton>
                          <ActionButton
                            tone="red"
                            disabled={!selectedRow}
                            onClick={() => {
                              const ok = window.confirm("Seguro que deseas eliminar esta fila / reserva?");
                              if (!ok || !selectedRow) return;
                              const reason = window.prompt("Motivo de anulacion:", "");
                              if (reason === null || reason.trim() === "") return;
                              cancelReservation(selectedRow, { reason });
                              setSelectedRow(null);
                              refreshReservations();
                            }}
                          >
                            Eliminar fila
                          </ActionButton>
                        </td>
                      </tr>
                    )}
                    {filtered.map((r) => (
                      <tr key={r.id} className={`border-t border-slate-200 ${selectedRow === r.id ? "bg-emerald-50" : ""}`}>
                        <td className="px-2 py-2 text-center border-x border-slate-200">{r.quantity || 1}</td>
                        <td className="px-2 py-2 border-x border-slate-200">{r.room?.type || "N/D"}</td>
                        <td className="px-2 py-2 border-x border-slate-200">
                          {r.mealPlan?.name || mealPlans.find((m) => String(m.id) === String(r.mealPlanId))?.name || r.ratePlan?.name || "N/D"}
                        </td>
                        <td className="px-2 py-2 text-center border-x border-slate-200">{r.adults || 0}</td>
                        <td className="px-2 py-2 text-center border-x border-slate-200">{r.children || 0}</td>
                        <td className="px-2 py-2 text-center border-x border-slate-200">{r.infants || 0}</td>
                        <td className="px-2 py-2 text-right border-x border-slate-200">{r.price ? `CRC ${r.price}` : "-"}</td>
                        <td className="px-2 py-2 border-x border-slate-200">{r.roomNumber || r.roomId}</td>
                        <td className="px-2 py-2 border-x border-slate-200">
                          {(r.rawStatus || r.status || "").toUpperCase() === "CONFIRMED" ? (
                            <StatusBadge status={r.status || r.rawStatus} />
                          ) : (
                            <span className="text-xs text-slate-400"></span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right space-x-1 border-x border-slate-200">
                          <ActionButton tone="blue" disabled={!canCheckIn(r) || loading.action} onClick={() => doCheckIn(r.id)}>
                            Check-in
                          </ActionButton>
                          <ActionButton tone="green" disabled={!canCheckOut(r) || loading.action} onClick={() => doCheckOut(r.id)}>
                            Check-out
                          </ActionButton>
                          <ActionButton tone="red" disabled={!canCancel(r) || loading.action} onClick={() => cancelReservation(r.id)}>
                            Cancelar
                          </ActionButton>
                          <button className="text-xs underline" onClick={() => loadReservation(r)}>
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {draftRows.map((r, idx) => (
                      <tr key={`draft-${idx}`} className="border-t border-slate-200 bg-amber-50">
                        <td className="px-2 py-2 text-center border-x border-slate-200">{r.quantity || 1}</td>
                        <td className="px-2 py-2 border-x border-slate-200">
                          {rooms.find((room) => String(room.id) === String(r.roomId))?.type || "N/D"}
                        </td>
                        <td className="px-2 py-2 border-x border-slate-200">
                          {mealPlans.find((m) => String(m.id) === String(r.mealPlanId))?.name || "N/D"}
                        </td>
                        <td className="px-2 py-2 text-center border-x border-slate-200">{r.adults || 0}</td>
                        <td className="px-2 py-2 text-center border-x border-slate-200">{r.children || 0}</td>
                        <td className="px-2 py-2 text-center border-x border-slate-200">{r.infants || 0}</td>
                        <td className="px-2 py-2 text-right border-x border-slate-200">{r.price ? `CRC ${r.price}` : "-"}</td>
                        <td className="px-2 py-2 border-x border-slate-200">
                          {rooms.find((room) => String(room.id) === String(r.roomId))?.number || r.roomId}
                        </td>
                        <td className="px-2 py-2 border-x border-slate-200">
                          <span className="text-xs text-amber-700">Borrador</span>
                        </td>
                        <td className="px-2 py-2 text-right space-x-1 border-x border-slate-200">
                          <ActionButton
                            tone="blue"
                            onClick={() => {
                              setShowRowEditor(true);
                              setForm(r);
                              setRowSaved(false);
                              setDraftRows((rows) => rows.filter((_, i) => i !== idx));
                            }}
                          >
                            Editar
                          </ActionButton>
                          <ActionButton
                            tone="red"
                            onClick={() => {
                              setDraftRows((rows) => rows.filter((_, i) => i !== idx));
                            }}
                          >
                            Eliminar
                          </ActionButton>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td className="p-3 text-center text-slate-500" colSpan={10}>
                          No hay reservaciones que coincidan con el filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-6 gap-[8px] text-xs text-slate-700 w-fit justify-start">
                <label className="flex flex-col gap-[4px] w-[130px]">
                  <span>Habitacion</span>
                  <input
                    type="number"
                    className="w-full max-w-[120px] rounded border px-2 py-1 text-xs bg-emerald-50 border-emerald-200 cursor-not-allowed"
                    value={form.priceRoom}
                    readOnly
                  />
                </label>
                <label className="flex flex-col gap-[4px] w-[130px]">
                  <span>Regimen</span>
                  <input
                    type="number"
                    className="w-full max-w-[120px] rounded border px-2 py-1 text-xs bg-emerald-50 border-emerald-200 cursor-not-allowed"
                    value={form.priceRegimen}
                    readOnly
                  />
                </label>
                <label className="flex flex-col gap-[4px] w-[130px]">
                  <span>Descuento</span>
                  <input
                    type="number"
                    className="w-full max-w-[120px] rounded border px-2 py-1 text-xs bg-emerald-50 border-emerald-200 cursor-not-allowed"
                    value={form.discount}
                    readOnly
                  />
                </label>
                <label className="flex flex-col gap-[4px] w-[130px]">
                  <span>Impuesto</span>
                  <input
                    type="number"
                    className="w-full max-w-[120px] rounded border px-2 py-1 text-xs bg-emerald-50 border-emerald-200 cursor-not-allowed"
                    value={form.priceTax}
                    readOnly
                  />
                </label>
                <label className="flex flex-col gap-[4px] w-[130px]">
                  <span>Deposito</span>
                  <input
                    type="number"
                    className="w-full max-w-[120px] rounded border px-2 py-1 text-xs bg-emerald-50 border-emerald-200 cursor-not-allowed"
                    value={form.depositAmount || 0}
                    readOnly
                  />
                </label>
                <label className="flex flex-col gap-[4px] w-[130px]">
                  <span>Total</span>
                  <input
                    type="number"
                    className="w-full max-w-[120px] rounded border px-2 py-1 text-xs bg-blue-50 border-blue-200"
                    value={(Number(form.price) || 0) - (Number(form.depositAmount) || 0)}
                    readOnly
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Barra de acciones rapidas */}
          <div className="flex flex-wrap gap-3 justify-end">
            {[
              { key: "new", title: "Nueva reserva", color: "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-800", icon: IconPlus, onClick: resetForm },
              { key: "save", title: "Guardar", color: "bg-gradient-to-br from-emerald-100 to-emerald-200 border-emerald-300 text-emerald-900", icon: IconSave, onClick: handleCreate },
              { key: "email", title: "Correo", color: "bg-gradient-to-br from-sky-50 to-sky-100 border-sky-200 text-sky-800", icon: IconMail, onClick: handleEmail },
              { key: "whatsapp", title: "WhatsApp", color: "bg-gradient-to-br from-green-50 to-green-100 border-green-200 text-green-800", icon: IconWhatsapp, onClick: handleWhatsapp },
              { key: "print", title: "Imprimir", color: "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 text-slate-800", icon: IconPrinter, onClick: handlePrint },
              { key: "confirm", title: "Confirmar", color: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 text-blue-800", icon: IconCheck, onClick: handleConfirmAction },
              { key: "cancel", title: "Cancelar", color: "bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200 text-rose-800", icon: IconClose, onClick: handleCancelAction },
            ].map(({ key, title, color, icon: Icon, onClick }) => (
              <button
                key={key}
                type="button"
                title={title}
                onClick={onClick}
                className={`h-12 w-12 rounded-2xl border shadow-md hover:shadow-lg hover:-translate-y-0.5 transition transform flex items-center justify-center ${color}`}
              >
                <Icon />
              </button>
            ))}
          </div>
        </div>
      </div>

      {showGuestPicker && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowGuestPicker(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-3xl max-h-[80vh] overflow-hidden border">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">Seleccionar perfil de huesped</h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                    <span>Tipo:</span>
                    <button
                      type="button"
                      className={`px-2 py-1 rounded-full border text-[11px] ${
                        guestType === "PERSON"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-700 border-slate-300"
                      }`}
                      onClick={() => setGuestType("PERSON")}
                    >
                      Clientes normales
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-1 rounded-full border text-[11px] ${
                        guestType === "COMPANY"
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-700 border-slate-300"
                      }`}
                      onClick={() => setGuestType("COMPANY")}
                    >
                      Empresas
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 text-lg leading-none flex items-center justify-center hover:bg-slate-200"
                  onClick={() => setShowGuestPicker(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
              <div className="p-4 space-y-3">
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Buscar por nombre, empresa, email, telefono o documento"
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value)}
                />
                <div className="max-h-[55vh] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-slate-500 border-b">
                        <th className="p-2">{guestType === "COMPANY" ? "Empresa" : "Nombre"}</th>
                        <th className="p-2">{guestType === "COMPANY" ? "Contacto" : "Email"}</th>
                        <th className="p-2">Telefono</th>
                        <th className="p-2">Documento</th>
                        <th className="p-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGuests.map((g) => (
                        <tr key={g.id} className="border-b hover:bg-slate-50">
                          <td className="p-2">
                            {guestType === "COMPANY"
                              ? g.company || "Empresa"
                              : `${g.firstName || ""} ${g.lastName || ""}`.trim() || "Sin nombre"}
                          </td>
                          <td className="p-2">
                            {guestType === "COMPANY" ? (
                              `${g.firstName || ""} ${g.lastName || ""}`.trim() || (
                                <span className="text-slate-400">Sin contacto</span>
                              )
                            ) : (
                              g.email || <span className="text-slate-400">Sin email</span>
                            )}
                          </td>
                          <td className="p-2">{g.phone || <span className="text-slate-400">Sin telefono</span>}</td>
                          <td className="p-2 text-xs">
                            {g.idType || g.idNumber
                              ? `${g.idType || ""} ${g.idNumber || ""}`.trim()
                              : <span className="text-slate-400">N/D</span>}
                          </td>
                          <td className="p-2 text-right">
                            <button
                              className="px-3 py-1 rounded border bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs"
                              onClick={() => selectGuest(g)}
                            >
                              Usar perfil
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!filteredGuests.length && (
                        <tr>
                          <td className="p-3 text-center text-slate-500" colSpan={5}>
                            No hay perfiles disponibles.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PillInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  prefix = "",
  inputClassName = "",
  containerClassName = "",
  pillClassName = "",
  disabled = false
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-slate-600 ${containerClassName}`}>
      <span>{label}</span>
      <div className={`flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-2 ${pillClassName}`}>
        {prefix && <span className="text-slate-400 text-sm">{prefix}</span>}
        <input
          type={type}
          className={`w-full bg-transparent outline-none text-slate-800 text-sm ${inputClassName} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </label>
  );
}

function PillSelect({ label, value, onChange, options, selectClassName = "" }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      <span>{label}</span>
      <select
        className={`w-full rounded-full bg-slate-100 border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ${selectClassName}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PillButton({ label, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`rounded-full border px-4 py-2 text-sm ${
        disabled ? "bg-slate-100 text-slate-400" : "bg-white text-slate-800 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function IconPlus() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconWhatsapp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 19l1.2-3.4A7.5 7.5 0 1 1 19.5 12a7.6 7.6 0 01-1 3.7A7.5 7.5 0 0112 19.5a7.6 7.6 0 01-3.6-.9z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9.5c0 2 2 4 4 4l1.1-.6c.2-.1.5 0 .6.2l.5 1c.1.2 0 .5-.2.6-.9.6-2 .8-3.1.6a5.4 5.4 0 01-3.5-3.5c-.2-1-.1-2.2.5-3.1.1-.2.4-.3.6-.2l1 .5c.2.1.3.3.2.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPrinter() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 4h10v4H7z" />
      <rect x="4.5" y="8" width="15" height="8" rx="2" />
      <path d="M8 15h8v5H8z" />
      <path d="M7 11h2M15 11h2" strokeLinecap="round" />
      <path d="M10 17.5h4" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 12.5l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
    </svg>
  );
}

function IconSave() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M7 17a5 5 0 01-.3-9.9A6 6 0 1117 11h1a4 4 0 010 8H7z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9v7m0 0l-3-3m3 3l3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
