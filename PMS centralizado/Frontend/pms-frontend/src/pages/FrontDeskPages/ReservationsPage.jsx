import React, { useEffect, useMemo, useState } from "react";
import { X, Pencil, User, Bed, Wallet, ArrowUpRight, Check, CreditCard } from "lucide-react";
import { useHotelData } from "../../context/useHotelData";
import { api } from "../../lib/api";
import { pushAlert } from "../../lib/uiAlerts";
import { frontdeskTheme } from "../../theme/frontdeskTheme";
import { useLanguage } from "../../context/LanguageContext";
import GuestPicker from "../../components/frontdesk/GuestPicker";

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

const StatusBadge = ({ status, label }) => {
  const meta = STATUS_META[status] || { bg: "bg-gray-100 text-gray-700 border-gray-200" };
  return <span className={`px-2 py-1 rounded border text-xs font-medium ${meta.bg}`}>{label || status || t("common.na")}</span>;
};

  const emptyForm = {
    guestId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    roomType: "",
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
  idNumber: "",
  idType: "",
  country: "",
  city: "",
  address: "",
  cardName: "",
  cardNumber: "",
  cardExpiry: "",
  cardCvv: "",
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
  const { t } = useLanguage();
  const {
    reservations,
    rooms,
    guests,
    loading,
    refreshReservations,
    refreshRooms,
    refreshGuests,
    createReservation,
    cancelReservation,
    createGuest,
    setReservations,
  } = useHotelData();

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [ratePlans, setRatePlans] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [showRowEditor, setShowRowEditor] = useState(false);
  const [rowSaved, setRowSaved] = useState(false);
  const [rowConfirmed, setRowConfirmed] = useState(false);
  const [draftRows, setDraftRows] = useState([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [modifyModal, setModifyModal] = useState(null); // reservation object to modify
  const [guestQuery, setGuestQuery] = useState("");
  const [guestType, setGuestType] = useState("PERSON"); // PERSON | COMPANY

  const statusLabel = (status) => {
    const raw = String(status || "");
    const upper = raw.toUpperCase();
    if (["CONFIRMED", "CONFIRMADA"].includes(upper)) return t("frontdesk.reservations.status.confirmed");
    if (["PENDING", "PENDIENTE"].includes(upper)) return t("frontdesk.reservations.status.pending");
    if (["CHECKED_IN", "CHECK-IN", "CHECKIN"].includes(upper)) return t("frontdesk.reservations.status.checkin");
    if (["CHECKED_OUT", "CHECK-OUT", "CHECKOUT"].includes(upper)) return t("frontdesk.reservations.status.checkout");
    if (["CANCELED", "CANCELADA"].includes(upper)) return t("frontdesk.reservations.status.canceled");
    return raw || t("common.na");
  };

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
          title: t("frontdesk.reservations.fromInvalidTitle"),
          desc: t("frontdesk.reservations.fromInvalidDesc"),
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

  // Rooming para agencias
  useEffect(() => {
    if (isAgencyPlan && !form.rooming) {
      setForm((f) => ({ ...f, rooming: `AG-RM-${String((reservations?.length || 0) + (draftRows?.length || 0) + 1).padStart(4, "0")}` }));
    }
  }, [isAgencyPlan, reservations?.length, draftRows?.length]);



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

        // Si el usuario elige una fecha menor o igual a "Desde", forzar siempre al d??a siguiente
        if (!v || parseLocal(v) <= from) {
          pushAlert({
            type: "system",
            title: t("frontdesk.reservations.toInvalidTitle"),
            desc: t("frontdesk.reservations.toInvalidDesc"),
          });
          return { ...f, checkOutDate: minStr };
        }
        return { ...f, checkOutDate: v };
      }
      // Si a??n no hay "Desde", simplemente guardamos lo seleccionado
      return { ...f, checkOutDate: v };
    });
  };

  const handleDepositClick = () => {
    const current = form.depositAmount ? String(form.depositAmount) : "";
    const input = window.prompt(t("frontdesk.reservations.depositPromptTitle"), current);
    if (input === null) return;
    const num = input === "" ? "" : Number(input);
    if (Number.isNaN(num)) {
      pushAlert({ type: "system", title: t("frontdesk.reservations.depositInvalidTitle"), desc: t("frontdesk.reservations.depositInvalidDesc") });
      return;
    }
    setForm((f) => ({ ...f, depositAmount: input === "" ? "" : num }));
  };

  useEffect(() => {
    refreshRooms();
    refreshGuests();
    refreshReservations();
    api
      .get("/ratePlans")
      .then(({ data }) => {
        if (Array.isArray(data)) setRatePlans(data);
      })
      .catch(() => {});
    api
      .get("/mealPlans")
      .then(({ data }) => {
        if (Array.isArray(data)) setMealPlans(data);
      })
      .catch(() => {});
    api
      .get("/contracts")
      .then(({ data }) => {
        if (Array.isArray(data)) setContracts(data);
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

  const sidebarReservations = filtered;
  const tableReservations = selectedRow ? filtered.filter((r) => r.id === selectedRow) : [];

  const buildGuest = async (row) => {
    let guestId = row.guestId;
    if (!guestId && conPerfil) {
      const hasFirst = !!row.firstName && row.firstName.trim().length > 0;
      const hasLast = !!row.lastName && row.lastName.trim().length > 0;
      if (!hasFirst && !hasLast) {
        throw new Error(t("frontdesk.reservations.errors.guestNameMissing"));
      }
      const firstName = (row.firstName || row.lastName || t("frontdesk.reservations.guestFallbackFirst")).trim();
      const lastName = (row.lastName || row.firstName || t("frontdesk.reservations.guestFallbackLast")).trim();

      // Buscar si ya existe un huésped con ese nombre
      try {
        const { data } = await api.get(`/guests?q=${encodeURIComponent(firstName + " " + lastName)}`);
        const found = Array.isArray(data) ? data.find(g =>
          g.firstName?.toLowerCase() === firstName.toLowerCase() &&
          g.lastName?.toLowerCase() === lastName.toLowerCase()
        ) : null;
        if (found) return found.id; // usar huésped existente
      } catch {} // silencioso

      try {
        const guest = await createGuest({
          firstName,
          lastName,
          email: row.email || undefined,
          phone: row.phone || undefined,
        });
        guestId = guest?.id;
      } catch (err) {
        // Si falla por duplicado (409), buscar el huésped existente
        if (err?.response?.status === 409) {
          const q = row.email || `${firstName} ${lastName}`;
          const { data } = await api.get(`/guests?q=${encodeURIComponent(q)}`);
          const found = Array.isArray(data) && data.length > 0 ? data[0] : null;
          if (found) guestId = found.id;
        }
      }

      // Si aún no hay guestId, no se puede crear la reserva
      if (!guestId) throw new Error("No se pudo encontrar ni crear el cliente");
    }
    return guestId;
  };

  const createReservationFromRow = async (row) => {
    const toISODate = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(`${dateStr}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? dateStr : d.toISOString();
    };

    const guestId = conPerfil ? await buildGuest(row) : undefined;
    return createReservation({
      roomId: row.roomId,
      guestId,
      guestName: !conPerfil ? `${row.firstName || ""} ${row.lastName || ""}`.trim() || undefined : undefined,
      checkInDate: toISODate(row.checkInDate),
      checkOutDate: toISODate(row.checkOutDate),
      adults: Number(row.adults) || 2,
      children: Number(row.children) || 0,
      infants: Number(row.infants) || 0,
      quantity: Number(row.quantity) || 1,
      contractId: row.contractId || undefined,
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
      code: row.code || undefined, // undefined = backend genera consecutivo
      hotelId: row.hotelId || undefined,
    });
  };

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    const rowsToSave = draftRows.length ? draftRows : [form];
    for (const r of rowsToSave) {
      if (!r.roomId || !r.checkInDate || !r.checkOutDate) return alert("Faltan datos: habitación y fechas requeridos");
      if (r.checkOutDate <= r.checkInDate) return alert("Check-out debe ser después del check-in");
    }
    if (!form.contractId) return alert("Selecciona un contrato");
    if (!form.ratePlanId) return alert("Selecciona un tarifario");
    try {
      setCreating(true);
      for (const row of rowsToSave) {
        await createReservationFromRow(row);
      }
      setSelectedRow(null);
      setDraftRows([]);
      await refreshReservations();
      await refreshRooms();
      setRowSaved(false);
      setRowConfirmed(false);
      setForm((f) => ({ ...emptyForm, ratePlanId: f.ratePlanId, contractId: f.contractId }));
      setSearch("");
      setShowRowEditor(false);
      setSuccessMsg("Reserva creada exitosamente");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err?.message || "Error al crear reserva");
      setTimeout(() => setErrorMsg(""), 4000);
    } finally {
      setCreating(false);
    }
  };

    const handleSaveRow = () => {
      if (!form.roomType) return alert("Selecciona un tipo de habitación");
      if (!form.roomId) return alert("Selecciona una habitación específica");
      if (!form.checkInDate || !form.checkOutDate) return alert("Fechas requeridas");
      if (form.checkOutDate <= form.checkInDate) return alert("Check-out debe ser después del check-in");
      setDraftRows((rows) => [...rows, { ...form }]);
      setRowSaved(true);
      setShowRowEditor(false);
      setForm((f) => ({
        ...f,
        roomType: "",
        roomId: "",
        mealPlanId: "",
        quantity: 1,
        adults: 2,
        children: 0,
        infants: 0,
        price: "",
      }));
    };

  const canCancel = (r) => {
    const code = (r.rawStatus || "").toUpperCase();
    return code !== "CANCELED" && code !== "CHECKED_OUT";
  };

  const resetForm = () => {
    setForm((f) => ({ ...emptyForm, ratePlanId: f.ratePlanId, contractId: f.contractId }));
    setSelectedRow(null);
  };

  const loadReservation = (r) => {
    if (!r) return;
    setSelectedRow(r.id);
    // Al seleccionar una reserva existente solo mostramos las filas guardadas;
    // el editor de filas se abre ??nicamente con el bot??n "Crear" o "Editar".
    setShowRowEditor(false);
    setRowSaved(false);
    setDraftRows([]);
      setForm({
        ...form,
        guestId: r.guestId || "",
        firstName: r.guest?.firstName || "",
        lastName: r.guest?.lastName || "",
        email: r.guest?.email || "",
        phone: r.guest?.phone || "",
        roomType: r.room?.type || form.roomType || "",
        roomId: r.roomId || "",
      checkInDate: r.checkInDate || "",
      checkOutDate: r.checkOutDate || "",
      adults: r.adults || 2,
      children: r.children || 0,
      contractId: r.contractId || "",
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
    if (!form.email) return alert("Email requerido");
    const room = rooms.find(r => r.id === form.roomId);
    const plan = ratePlans.find(r => r.id === form.ratePlanId);
    const nights = form.checkInDate && form.checkOutDate
      ? Math.max(1, Math.ceil((new Date(form.checkOutDate) - new Date(form.checkInDate)) / 86400000)) : 0;
    const subject = encodeURIComponent(`Confirmación de reserva ${form.code || ""}`);
    const body = encodeURIComponent(
      `Estimado/a ${form.firstName} ${form.lastName},\n\n` +
      `Su reserva ha sido confirmada:\n` +
      `Código: ${form.code || "—"}\n` +
      `Habitación: ${room?.number || "—"} (${room?.type || ""})\n` +
      `Check-in: ${form.checkInDate}\n` +
      `Check-out: ${form.checkOutDate}\n` +
      `Noches: ${nights}\n` +
      `Clientes: ${form.adults || 0} adultos, ${form.children || 0} niños\n` +
      `Tarifa: ${plan?.name || "—"} — CRC ${Number(form.price || 0).toLocaleString()}\n\n` +
      `Gracias por elegirnos.`
    );
    window.location.href = `mailto:${form.email}?subject=${subject}&body=${body}`;
  };

  const handleWhatsapp = () => {
    const phone = (form.phone || "").replace(/\D/g, "");
    if (!phone) return alert("Teléfono requerido");
    const room = rooms.find(r => r.id === form.roomId);
    const nights = form.checkInDate && form.checkOutDate
      ? Math.max(1, Math.ceil((new Date(form.checkOutDate) - new Date(form.checkInDate)) / 86400000)) : 0;
    const msg = encodeURIComponent(
      `✅ *Reserva Confirmada*\n` +
      `Código: ${form.code || "—"}\n` +
      `Hab: ${room?.number || "—"} (${room?.type || ""})\n` +
      `📅 ${form.checkInDate} → ${form.checkOutDate} (${nights} noches)\n` +
      `👤 ${form.firstName} ${form.lastName}\n` +
      `💰 CRC ${Number(form.price || 0).toLocaleString()}`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank", "noopener");
  };

  const handlePrint = () => window.print();

  const [nameInput, setNameInput] = useState(
    [form.firstName, form.lastName].filter(Boolean).join(" ")
  );

  const [conPerfil, setConPerfil] = useState(true); // true = con perfil, false = sin perfil

  // Sincronizar nameInput cuando firstName/lastName cambian externamente (perfiles, ID lookup)
  useEffect(() => {
    const display = [form.firstName, form.lastName].filter(Boolean).join(" ");
    if (display && display !== nameInput) setNameInput(display);
  }, [form.firstName, form.lastName]);

  const handleNameChange = (value) => {
    setNameInput(value);
  };

  const handleNameBlur = () => {
    const clean = nameInput.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, "").trim();
    const parts = clean.split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    setForm((f) => ({ ...f, firstName, lastName }));
  };

  const sanitizeEmail = (v) => v.replace(/[<>"'&]/g, "");

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
      const key = r.type || t("frontdesk.reservations.noType");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return Array.from(map.entries());
  }, [rooms, t]);

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
        list.map((r) => (r.id === selectedRow ? { ...r, rawStatus: "CONFIRMED", status: "CONFIRMED" } : r))
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
      const ok = window.confirm(t("frontdesk.reservations.confirmVoid"));
      if (!ok) return;
      const reason = window.prompt(t("frontdesk.reservations.voidReasonPrompt"), "");
      if (reason === null || reason.trim() === "") return;
      cancelReservation(selectedRow, { reason });
      setSelectedRow(null);
      refreshReservations();
      return;
    }
    resetForm();
  };

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{ background: frontdeskTheme.background.app }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("frontdesk.reservations.title")}</h1>
          <p className="text-sm text-slate-600">{t("frontdesk.reservations.subtitle")}</p>
        </div>
        <div className="flex gap-2 items-end">
          <PillInput
            label={t("frontdesk.reservations.labels.search")}
            value={search}
            onChange={setSearch}
            placeholder={t("frontdesk.reservations.placeholders.search")}
            containerClassName="min-w-[220px]"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Created reservations sidebar */}
        <div className="w-full lg:w-64 rounded-2xl border bg-white shadow-sm p-3 space-y-2">
          <div className="text-sm font-semibold text-slate-800">{t("frontdesk.reservations.sidebarTitle")}</div>
          <div className="space-y-1 max-h-[400px] overflow-auto">
            {sidebarReservations.map((r) => (
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
                    {r.guestName || `${r.guest?.firstName || ""} ${r.guest?.lastName || ""}`.trim() || t("frontdesk.reservations.noName")}
                  </div>
                </button>
            ))}
            {sidebarReservations.length === 0 && <div className="text-xs text-slate-500">{t("frontdesk.reservations.sidebarEmpty")}</div>}
          </div>
        </div>

        {/* Contenido principal — FORMULARIO REDISEÑADO */}
        <div className="flex-1 space-y-4">
          <div className="rounded-2xl border shadow-sm p-5 space-y-5" style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>

            {/* ── FILA SUPERIOR ── */}
            <div className="flex flex-wrap gap-2">
              <div className="w-[130px]">
                <label className="text-[10px] font-medium mb-0.5 block opacity-50">Check-in *</label>
                <input type="date" value={form.checkInDate} onChange={(e) => handleDateFrom(e.target.value)}
                  className="w-full rounded-lg border px-2 py-2 text-xs" style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
              </div>
              <div className="w-[130px]">
                <label className="text-[10px] font-medium mb-0.5 block opacity-50">Check-out *</label>
                <input type="date" value={form.checkOutDate} onChange={(e) => handleDateTo(e.target.value)}
                  min={form.checkInDate ? (() => { const d = new Date(form.checkInDate); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })() : undefined}
                  className="w-full rounded-lg border px-2 py-2 text-xs" style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
              </div>
              <div className="w-16">
                <label className="text-[10px] font-medium mb-0.5 block opacity-50">Noches</label>
                <input type="text" readOnly
                  value={form.checkInDate && form.checkOutDate ? Math.max(1, Math.ceil((new Date(form.checkOutDate) - new Date(form.checkInDate)) / 86400000)) : "—"}
                  className="w-full rounded-lg border px-2 py-2 text-xs text-center bg-slate-50 dark:bg-slate-800" style={{ borderColor: "var(--input-border)", color: "var(--color-text-base)" }} />
              </div>
              <div className="w-24">
                <label className="text-[10px] font-medium mb-0.5 block opacity-50">ID Reserva</label>
                <input type="text" value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: v }))}
                  placeholder="Auto" className="w-full rounded-lg border px-2 py-2 text-xs text-center"
                  style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
              </div>
              <div style={{ width: 170 }}>
                <label className="text-[10px] font-medium mb-0.5 block opacity-50">Contrato / Canal</label>
                <ContratoCanalGroup form={form} setForm={setForm} contracts={contracts} />
              </div>
              <div style={{ width: 150 }}>
                <label className="text-[10px] font-medium mb-0.5 block opacity-50">Tarifario</label>
                <select value={form.ratePlanId} onChange={(e) => {
                  const rp = ratePlans.find(r => r.id === e.target.value);
                  setForm((f) => ({ ...f, ratePlanId: e.target.value, price: rp?.price || f.price || "", priceRoom: rp?.price || "" }));
                }}
                  className="w-full rounded-lg border px-2 py-2 text-xs"
                  style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}>
                  <option value="">Sin tarifa</option>
                  {ratePlans.filter((r) => {
                    if (!form.contractId) return true;
                    const c = contracts.find((x) => String(x.id) === String(form.contractId));
                    const ids = Array.isArray(c?.ratePlans) ? c.ratePlans : [];
                    return ids.includes(String(r.id));
                  }).map((r) => (
                    <option key={r.id} value={r.id}>{r.name} — ₡{Number(r.price||0).toLocaleString()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── FILA: Cliente ── */}
            <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--card-border)", background: "var(--input-bg)" }}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--color-text-base)" }}>
                  <User size={13} className="text-emerald-500" /> Cliente
                </h3>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border overflow-hidden text-[10px]"
                    style={{ borderColor: "var(--card-border)" }}>
                    <button type="button"
                      onClick={() => setConPerfil(true)}
                      className={`px-2.5 py-1.5 ${conPerfil ? "bg-emerald-500 text-white" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                      style={!conPerfil ? { color: "var(--color-text-muted)" } : {}}>
                      Con perfil
                    </button>
                    <button type="button"
                      onClick={() => setConPerfil(false)}
                      className={`px-2.5 py-1.5 ${!conPerfil ? "bg-amber-500 text-white" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                      style={conPerfil ? { color: "var(--color-text-muted)" } : {}}>
                      Sin perfil
                    </button>
                  </div>
                  {conPerfil && <PillButton label={t("frontdesk.reservations.labels.profiles")} onClick={handlePickProfile} />}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="w-64">
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Nombre completo *</label>
                  <input type="text" value={nameInput} onChange={(e) => handleNameChange(e.target.value)} onBlur={handleNameBlur}
                    placeholder="Nombre Apellido" className="w-full rounded-lg border px-2.5 py-2 text-xs"
                    style={{ borderColor: "var(--input-border)", background: "var(--card-bg)", color: "var(--color-text-base)" }} />
                </div>
                <div className="w-44">
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: sanitizeEmail(e.target.value) }))}
                    placeholder="correo@ejemplo.com" className="w-full rounded-lg border px-2.5 py-2 text-xs"
                    style={{ borderColor: "var(--input-border)", background: "var(--card-bg)", color: "var(--color-text-base)" }} />
                </div>
                <div className="w-36">
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Teléfono</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
                    placeholder="+506 0000-0000" className="w-full rounded-lg border px-2.5 py-2 text-xs"
                    style={{ borderColor: "var(--input-border)", background: "var(--card-bg)", color: "var(--color-text-base)" }} />
                </div>
                <div className="w-36">
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Identificación</label>
                  <div className="flex gap-1">
                    <select value={form.idType||""} onChange={(e) => setForm((f) => ({ ...f, idType: e.target.value, idNumber: "" }))}
                      className="w-16 rounded-lg border px-1 py-2 text-[10px]"
                      style={{ borderColor: "var(--input-border)", background: "var(--card-bg)", color: "var(--color-text-base)" }}>
                      <option value="">Tipo</option>
                      <option value="CEDULA_FISICA">Céd.</option>
                      <option value="CEDULA_JURIDICA">C.J.</option>
                      <option value="DIMEX">DIMEX</option>
                      <option value="PASAPORTE">Pasap.</option>
                      <option value="OTRO">Otro</option>
                    </select>
                    <input type="text" value={form.idNumber||""}
                      disabled={!form.idType}
                      onChange={(e) => {
                        let v = e.target.value;
                        const max = form.idType === "CEDULA_FISICA" ? 9 : form.idType === "CEDULA_JURIDICA" ? 10 : form.idType === "DIMEX" ? 12 : 20;
                        if (form.idType === "PASAPORTE") v = v.replace(/[^a-zA-Z0-9]/g, "").slice(0, max);
                        else if (form.idType && form.idType !== "OTRO") v = v.replace(/\D/g, "").slice(0, max);
                        setForm((f) => ({ ...f, idNumber: v }));
                      }}
                      onBlur={async () => {
                        // Si hay ID y tipo, buscar huésped existente
                        if (!form.idNumber || !form.idType) return;
                        try {
                          const { data } = await api.get(`/guests?q=${encodeURIComponent(form.idNumber)}`);
                          const found = Array.isArray(data) ? data.find(g => g.idNumber === form.idNumber || g.idNumber === form.idNumber?.replace(/\D/g,"")) : null;
                          if (found) {
                            setForm((f) => ({
                              ...f,
                              guestId: found.id, firstName: found.firstName || "", lastName: found.lastName || "",
                              email: found.email || "", phone: found.phone || "", idType: found.idType || f.idType,
                              country: found.country || f.country, city: found.city || f.city, address: found.address || f.address,
                            }));
                          }
                        } catch {} // silencioso si falla
                      }}
                      placeholder={form.idType ? "Número" : "Selecciona tipo"}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs ${!form.idType ? "opacity-50 cursor-not-allowed" : ""}`}
                      style={{ borderColor: "var(--input-border)", background: "var(--card-bg)", color: "var(--color-text-base)" }} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="w-32">
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">País</label>
                  <CountrySelect value={form.country||""} onChange={(v) => setForm((f) => ({ ...f, country: v }))} />
                </div>
                <div className="w-32">
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Ciudad</label>
                  <input type="text" value={form.city||""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value.replace(/\d/g, "") }))}
                    placeholder="Ciudad" className="w-full rounded-lg border px-2.5 py-2 text-xs"
                    style={{ borderColor: "var(--input-border)", background: "var(--card-bg)", color: "var(--color-text-base)" }} />
                </div>
                <div className="flex-1" style={{ minWidth: 180 }}>
                  <label className="text-[10px] font-medium mb-0.5 block opacity-50">Dirección</label>
                  <input type="text" value={form.address||""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Dirección completa" className="w-full rounded-lg border px-2.5 py-2 text-xs"
                    style={{ borderColor: "var(--input-border)", background: "var(--card-bg)", color: "var(--color-text-base)" }} />
                </div>
              </div>
            </div>

            {/* ── TARJETA DE CRÉDITO (colapsable) ── */}
            <CreditCardSection form={form} setForm={setForm} />

            {/* ── HABITACIONES: Cards en vez de tabla ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--color-text-base)" }}>
                  <Bed size={15} className="text-blue-500" /> Habitaciones
                </h3>
                <PillButton
                  label={t("frontdesk.reservations.actions.create")}
                  onClick={() => { setShowRowEditor(true); setSelectedRow(null); setRowSaved(false); setRowConfirmed(false); }}
                  disabled={creating}
                />
              </div>

              {/* Editor de fila */}
              {showRowEditor && (
                <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
                  <div className="flex flex-wrap gap-2">
                    <div className="w-14">
                      <label className="text-[11px] font-medium mb-1 block opacity-50">Cant.</label>
                      <input type="number" min="1" className="w-full rounded-lg border px-2 py-2 text-xs" value={form.quantity || 1}
                        onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) || 1 }))}
                        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
                    </div>
                    <div style={{ width: 120 }}>
                      <label className="text-[11px] font-medium mb-1 block opacity-50">Tipo</label>
                      <select className="w-full rounded-lg border px-2 py-2 text-xs"
                        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
                        value={form.roomType} onChange={(e) => setForm((f) => ({ ...f, roomType: e.target.value, roomId: "" }))}>
                        <option value="">Tipo...</option>
                        {roomsByType.map(([type]) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div style={{ width: 110 }}>
                      <label className="text-[11px] font-medium mb-1 block opacity-50">Habitación</label>
                      <select className="w-full rounded-lg border px-2 py-2 text-xs"
                        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
                        value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}>
                        <option value="">Hab...</option>
                        {rooms.filter((r) => (form.roomType ? r.type === form.roomType : false)).map((room) => (
                          <option key={room.id} value={room.id}>Hab. {room.number || room.name || room.id}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: 120 }}>
                      <label className="text-[11px] font-medium mb-1 block opacity-50">Plan comidas</label>
                      <select className="w-full rounded-lg border px-2 py-2 text-xs"
                        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
                        value={form.mealPlanId} onChange={(e) => setForm((f) => ({ ...f, mealPlanId: e.target.value }))}>
                        <option value="">Sin plan</option>
                        {mealPlans.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div className="w-14">
                      <label className="text-[11px] font-medium mb-1 block opacity-50">Ad.</label>
                      <input type="number" min="1" className="w-full rounded-lg border px-2 py-2 text-xs" value={form.adults}
                        onChange={(e) => setForm((f) => ({ ...f, adults: Number(e.target.value) || 1 }))}
                        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
                    </div>
                    <div className="w-14">
                      <label className="text-[11px] font-medium mb-1 block opacity-50">Niñ.</label>
                      <input type="number" min="0" className="w-full rounded-lg border px-2 py-2 text-xs" value={form.children}
                        onChange={(e) => setForm((f) => ({ ...f, children: Number(e.target.value) || 0 }))}
                        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
                    </div>
                    <div className="w-14">
                      <label className="text-[11px] font-medium mb-1 block opacity-50">Inf.</label>
                      <input type="number" min="0" className="w-full rounded-lg border px-2 py-2 text-xs" value={form.infants}
                        onChange={(e) => setForm((f) => ({ ...f, infants: Number(e.target.value) || 0 }))}
                        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
                    </div>
                    <div className="w-24">
                      <label className="text-[11px] font-medium mb-1 block opacity-50">Precio</label>
                      <input type="number" min="0" step="0.01" className="w-full rounded-lg border px-2 py-2 text-xs" value={form.price || ""}
                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                        placeholder={(() => {
                          const rp = ratePlans.find(r => r.id === form.ratePlanId);
                          return rp?.price ? `₡${Number(rp.price).toLocaleString()}` : form.priceRoom ? `₡${form.priceRoom}` : "Manual";
                        })()}
                        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
                    </div>
                    <div className="w-16">
                      <label className="text-[11px] font-medium mb-1 block opacity-50">IVA</label>
                      <input type="text" readOnly
                        value={(() => {
                          const rp = ratePlans.find(r => r.id === form.ratePlanId);
                          const taxRate = Number(rp?.taxes || rp?.taxAmount || rp?.iva || 13);
                          const price = Number(form.price || rp?.price || form.priceRoom || 0);
                          const taxAmount = price > 0 ? Math.round(price * taxRate / 100) : 0;
                          return taxAmount > 0 ? `₡${taxAmount.toLocaleString()}` : "—";
                        })()}
                        className="w-full rounded-lg border px-2 py-2 text-xs text-center bg-slate-50 dark:bg-slate-800"
                        style={{ borderColor: "var(--input-border)", color: "var(--color-text-base)" }} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <ActionButton tone="green" disabled={creating || rowSaved} onClick={handleSaveRow}>Guardar fila</ActionButton>
                    <ActionButton tone="green" disabled={creating || rowSaved} onClick={() => { handleSaveRow(); setShowRowEditor(true); }}>
                      + Otra
                    </ActionButton>
                    <ActionButton tone="blue" disabled={!rowSaved} onClick={() => { setRowSaved(false); setRowConfirmed(false); }}>Editar</ActionButton>
                  </div>
                </div>
              )}

              {/* Lista de habitaciones agregadas */}
              <div className="space-y-2">
                {draftRows.map((r, idx) => (
                  <div key={`draft-${idx}`} className="flex items-center gap-3 rounded-xl border p-3"
                    style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <Bed size={14} className="text-amber-600" />
                    </div>
                    <div className="flex-1 grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                      <span style={{ color: "var(--color-text-base)" }}><strong>{r.quantity}x</strong> {rooms.find(rm => rm.id === r.roomId)?.type || "—"}</span>
                      <span style={{ color: "var(--color-text-muted)" }}>Hab. {rooms.find(rm => rm.id === r.roomId)?.number || r.roomId}</span>
                      <span style={{ color: "var(--color-text-muted)" }}>{r.adults}A {r.children}N</span>
                      <span style={{ color: "var(--color-text-muted)" }}>{mealPlans.find(m => m.id === r.mealPlanId)?.name || "—"}</span>
                      <span className="text-amber-600 font-medium">{t("frontdesk.reservations.draft")}</span>
                    </div>
                    <ActionButton tone="blue" onClick={() => { setShowRowEditor(true); setForm(r); setRowSaved(false); setDraftRows((rows) => rows.filter((_, i) => i !== idx)); }}>Editar</ActionButton>
                  </div>
                ))}
                {tableReservations.map((r) => (
                  <div key={r.id} className={`flex items-center gap-3 rounded-xl border p-3 ${selectedRow === r.id ? "ring-2 ring-emerald-400" : ""}`}
                    style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <Bed size={14} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                      <span style={{ color: "var(--color-text-base)" }}><strong>{r.quantity || 1}x</strong> {r.room?.type || "—"}</span>
                      <span style={{ color: "var(--color-text-muted)" }}>Hab. {r.roomNumber || r.roomId}</span>
                      <span style={{ color: "var(--color-text-muted)" }}>{r.adults || 0}A {r.children || 0}N</span>
                      <span style={{ color: "var(--color-text-muted)" }}>{r.mealPlan?.name || mealPlans.find(m => m.id === r.mealPlanId)?.name || "—"}</span>
                      <span className="font-medium text-emerald-600">{r.price ? `CRC ${r.price}` : "—"}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button className="text-xs underline" onClick={() => loadReservation(r)}>Editar</button>
                      <ActionButton tone="red" disabled={!canCancel(r)} onClick={() => cancelReservation(r.id)}>Anular</ActionButton>
                    </div>
                  </div>
                ))}
                {draftRows.length === 0 && tableReservations.length === 0 && !showRowEditor && (
                  <div className="text-center py-8 rounded-xl border-2 border-dashed"
                    style={{ borderColor: "var(--card-border)" }}>
                    <Bed size={28} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Sin habitaciones. Haz clic en "Crear" para agregar.</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── DEPÓSITOS (pre-pagos asociados) ── */}
            {selectedRow && (
              <DepositsSection reservationId={selectedRow} />
            )}

            {/* ── EXTRAS: Pre-pago, Descuento ── */}
            <div className="flex flex-wrap gap-2 max-w-xl">
              <div className="flex-1" style={{ minWidth: 200 }}>
                <label className="text-xs font-medium mb-0.5 flex items-center gap-1 opacity-50">
                  <Wallet size={11}/> Pre-pago
                </label>
                <PrePagoButton reservationId={selectedRow} currentDeposit={form.depositAmount}
                  onSelect={(amount) => setForm((f) => ({ ...f, depositAmount: amount }))} />
              </div>
              <div style={{ width: 180 }}>
                <label className="text-xs font-medium mb-0.5 flex items-center gap-1 opacity-50">
                  Descuento
                </label>
                <DiscountPicker value={form.discount} onChange={(v) => setForm((f) => ({ ...f, discount: v }))} />
              </div>
            </div>

            {/* ── ACCIONES ── */}
            <div className="flex gap-2 justify-end pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
              <ActionButton tone="blue" onClick={handleEmail} disabled={!form.email}>Email</ActionButton>
              <ActionButton tone="blue" onClick={handleWhatsapp} disabled={!form.phone}>WhatsApp</ActionButton>
              <ActionButton tone="gray" onClick={handlePrint}>Imprimir</ActionButton>
              <ActionButton tone="green" disabled={creating || (!form.roomId && draftRows.length === 0)} onClick={handleCreate}>
                {creating ? "Creando..." : "Crear Reserva"}
              </ActionButton>
              <ActionButton tone="red" onClick={handleCancelAction}>Cancelar</ActionButton>
            </div>

          </div>
        </div>
      </div>

      {showGuestPicker && (
        <GuestPicker
          isOpen={showGuestPicker}
          onClose={() => setShowGuestPicker(false)}
          onSelect={(g) => {
            setForm((f) => ({ ...f, guestId: g.id, firstName: g.firstName || "", lastName: g.lastName || "", email: g.email || "", phone: g.phone || "", idNumber: g.idNumber || "", idType: g.idType || "", country: g.country || "", city: g.city || "", address: g.address || "" }));
            setShowGuestPicker(false);
          }}
        />
      )}

      {modifyModal && (
        <ModifyReservationModal
          reservation={modifyModal}
          rooms={rooms}
          ratePlans={ratePlans}
          mealPlans={mealPlans}
          onClose={() => setModifyModal(null)}
          onSaved={async () => { setModifyModal(null); await refreshReservations(); await refreshRooms(); }}
        />
      )}

      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="rounded-2xl border bg-white dark:bg-slate-800 shadow-2xl px-5 py-4 flex items-center gap-3"
            style={{ borderColor: "var(--card-border)" }}>
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Check size={22} className="text-emerald-500" />
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--color-text-base)" }}>¡Listo!</div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{successMsg}</div>
            </div>
            <button onClick={() => setSuccessMsg("")} className="ml-2 p-1 rounded-lg hover:bg-black/5"><X size={14}/></button>
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="rounded-2xl border bg-white dark:bg-slate-800 shadow-2xl px-5 py-4 flex items-center gap-3"
            style={{ borderColor: "var(--card-border)" }}>
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <X size={22} className="text-rose-500" />
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--color-text-base)" }}>Error</div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{errorMsg}</div>
            </div>
            <button onClick={() => setErrorMsg("")} className="ml-2 p-1 rounded-lg hover:bg-black/5"><X size={14}/></button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModifyReservationModal({ reservation, rooms, ratePlans, mealPlans, onClose, onSaved }) {
  const [form, setForm] = useState({
    checkIn:   reservation.checkIn   ? new Date(reservation.checkIn).toISOString().slice(0,10)  : "",
    checkOut:  reservation.checkOut  ? new Date(reservation.checkOut).toISOString().slice(0,10) : "",
    roomId:    reservation.roomId    || "",
    ratePlanId: reservation.ratePlanId || "",
    mealPlanId: reservation.mealPlanId || "",
    adults:    reservation.adults    ?? 2,
    children:  reservation.children  ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSave() {
    if (!form.checkIn || !form.checkOut) { setError("Fechas requeridas"); return; }
    if (form.checkIn >= form.checkOut) { setError("Check-in debe ser antes del check-out"); return; }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/reservations/${reservation.id}`, {
        checkIn:   new Date(form.checkIn  + "T00:00:00Z").toISOString(),
        checkOut:  new Date(form.checkOut + "T00:00:00Z").toISOString(),
        roomId:    form.roomId    || undefined,
        ratePlanId: form.ratePlanId || undefined,
        mealPlanId: form.mealPlanId || null,
        adults:    Number(form.adults),
        children:  Number(form.children),
      });
      await onSaved();
    } catch (e) {
      setError(e?.response?.data?.message || "Error al modificar la reserva");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-slate-800">Modificar Reserva — {reservation.code}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded"><X className="w-5 h-5"/></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 rounded px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Check-in</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.checkIn} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Check-out</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.checkOut} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Habitación</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.roomId} onChange={e => setForm(f => ({ ...f, roomId: e.target.value }))}>
              {rooms.map(r => <option key={r.id} value={r.id}>#{r.number} — {r.type}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Tarifario</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.ratePlanId} onChange={e => setForm(f => ({ ...f, ratePlanId: e.target.value }))}>
              <option value="">Sin cambio</option>
              {ratePlans.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Plan de comida</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.mealPlanId} onChange={e => setForm(f => ({ ...f, mealPlanId: e.target.value }))}>
              <option value="">Ninguno</option>
              {mealPlans.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Adultos</label>
              <input type="number" min="1" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.adults} onChange={e => setForm(f => ({ ...f, adults: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Niños</label>
              <input type="number" min="0" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.children} onChange={e => setForm(f => ({ ...f, children: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm hover:bg-amber-400 font-medium disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
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

// ── Componente inline: muestra depósitos de una reservación ──
function DepositsSection({ reservationId }) {
  const [deps, setDeps] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!reservationId) return;
    setLoading(true);
    api.get(`/reservations/deposits?reservationId=${reservationId}`)
      .then(({ data }) => setDeps(Array.isArray(data) ? data : []))
      .catch(() => setDeps([]))
      .finally(() => setLoading(false));
  }, [reservationId]);

  if (!deps.length) return null;

  const total = deps.reduce((s, d) => s + Number(d.amount || 0), 0);
  const applied = deps.filter(d => d.appliedInvoice).reduce((s, d) => s + Number(d.amount || 0), 0);

  return (
    <div className="rounded-xl border p-3 space-y-2 text-xs" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
      <div className="flex items-center justify-between">
        <span className="font-semibold flex items-center gap-1" style={{ color: "var(--color-text-base)" }}>
          <Wallet size={13} className="text-emerald-500"/> Pre-pagos ({deps.length})
        </span>
        <span style={{ color: "var(--color-text-muted)" }}>
          Total: <strong style={{ color: "var(--color-text-base)" }}>₡{total.toLocaleString()}</strong>
          {applied > 0 && <span className="text-blue-600 ml-1">· Aplicado: ₡{applied.toLocaleString()}</span>}
          {total - applied > 0 && <span className="text-amber-600 ml-1">· Pendiente: ₡{(total - applied).toLocaleString()}</span>}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {deps.map(d => (
          <div key={d.id} className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[11px] ${
            d.appliedInvoice ? "bg-blue-50 dark:bg-blue-900/20" : "bg-amber-50 dark:bg-amber-900/20"
          }`}>
            <span className="font-medium" style={{ color: "var(--color-text-base)" }}>
              {d.voucher && <span className="opacity-40 mr-0.5">#{d.voucher}</span>}
              {d.currency} {Number(d.amount).toLocaleString()}
            </span>
            <span className="opacity-50">{d.paymentMethod || ""}</span>
            {d.appliedInvoice
              ? <Check size={11} className="text-blue-500"/>
              : <ArrowUpRight size={11} className="text-amber-500"/>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PrePagoButton: botón que muestra pre-pagos disponibles ──
function PrePagoButton({ reservationId, currentDeposit, onSelect }) {
  const [open, setOpen] = useState(false);
  const [deps, setDeps] = useState([]);
  useEffect(() => { if (open) api.get("/reservations/deposits").then(r => setDeps(Array.isArray(r.data)?r.data:[])).catch(()=>{}); }, [open]);
  const unassigned = deps.filter(d => !d.reservationId && !d.appliedInvoice);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full rounded-lg border px-2 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: currentDeposit ? "var(--color-text-base)" : "var(--color-text-muted)" }}>
        <span>{currentDeposit ? `₡${Number(currentDeposit).toLocaleString()}` : "Asignar pre-pago"}</span>
        {unassigned.length > 0 && <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full">{unassigned.length} disponible{unassigned.length>1?"s":""}</span>}
      </button>
      {open && (
        <div className="absolute z-40 top-full mt-1 w-72 rounded-xl border shadow-xl p-2 space-y-1 max-h-60 overflow-y-auto"
          style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
          {currentDeposit && (
            <button onClick={() => { onSelect(""); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-50">✕ Quitar pre-pago</button>
          )}
          {unassigned.length === 0 && !currentDeposit && <p className="text-xs px-2 py-2 opacity-50">Sin pre-pagos disponibles</p>}
          {unassigned.map(d => (
            <button key={d.id} onClick={() => { onSelect(d.amount); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex justify-between">
              <span style={{ color: "var(--color-text-base)" }}>{d.voucher && <span className="opacity-40">#{d.voucher} </span>}{d.currency} {Number(d.amount).toLocaleString()}</span>
              <span className="text-[10px] opacity-50 truncate ml-2 max-w-[120px]">{d.description||""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DiscountPicker: carga descuentos desde Management ──
function DiscountPicker({ value, onChange }) {
  const [discounts, setDiscounts] = useState([]);
  useEffect(() => { api.get("/discounts").then(r => setDiscounts(Array.isArray(r.data)?r.data.filter(d=>d.active):[])).catch(()=>{}); }, []);
  return (
    <div className="flex gap-1">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="flex-1 rounded-lg border px-1.5 py-2 text-xs"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}>
        <option value="">Sin desc.</option>
        {discounts.map(d => (
          <option key={d.id} value={d.value}>{d.name} ({d.type==="percent"?`${d.value}%`:`₡${d.value}`})</option>
        ))}
      </select>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        placeholder="Manual" className="w-14 rounded-lg border px-1.5 py-2 text-xs"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
    </div>
  );
}

// ── Sección de Tarjeta de Crédito (colapsable) ──
function CreditCardSection({ form, setForm }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium"
        style={{ color: "var(--color-text-base)" }}>
        <span className="flex items-center gap-1.5"><CreditCard size={13} className="text-purple-500"/> Datos de tarjeta</span>
        <span className="text-[10px] opacity-40">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-wrap gap-2">
          <div className="w-64">
            <label className="text-[10px] font-medium mb-0.5 block opacity-50">Titular de la tarjeta</label>
            <input value={form.cardName||""} onChange={e => setForm(f=>({...f,cardName:e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g,"")}))}
              placeholder="Nombre en la tarjeta" className="w-full rounded-lg border px-2.5 py-2 text-xs"
              style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
          </div>
          <div className="w-36">
            <label className="text-[10px] font-medium mb-0.5 block opacity-50">Número de tarjeta</label>
            <input value={form.cardNumber||""} onChange={e => setForm(f=>({...f,cardNumber:e.target.value.replace(/\D/g,"").slice(0,16)}))}
              placeholder="0000 0000 0000 0000" maxLength={19} className="w-full rounded-lg border px-2.5 py-2 text-xs"
              style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
          </div>
          <div className="w-20">
            <label className="text-[10px] font-medium mb-0.5 block opacity-50">Vencimiento</label>
            <input value={form.cardExpiry||""} onChange={e => {
              let v = e.target.value.replace(/\D/g,"").slice(0,4);
              if (v.length > 2) v = v.slice(0,2) + "/" + v.slice(2);
              setForm(f=>({...f,cardExpiry:v}));
            }} placeholder="MM/AA" maxLength={5} className="w-full rounded-lg border px-2.5 py-2 text-xs"
              style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
          </div>
          <div className="w-12">
            <label className="text-[10px] font-medium mb-0.5 block opacity-50">CVV</label>
            <input value={form.cardCvv||""} onChange={e => setForm(f=>({...f,cardCvv:e.target.value.replace(/\D/g,"").slice(0,4)}))}
              placeholder="···" type="password" maxLength={4} className="w-full rounded-lg border px-2.5 py-2 text-xs text-center"
              style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── ContratoCanalGroup: solo contrato desde management ──
function ContratoCanalGroup({ form, setForm, contracts }) {
  return (
    <select value={form.contractId} onChange={e => { setForm(f => ({ ...f, contractId: e.target.value, ratePlanId: "" })); }}
      className="w-full rounded-lg border px-1.5 py-2 text-xs"
      style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}>
      <option value="">Contrato...</option>
      {contracts.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
    </select>
  );
}

// ── OtaInfoPanel simplificado ──
function OtaInfoPanel({ otaCode, source, channel, onOtaChange, onSourceChange, onChannelChange }) {
  return (
    <div className="space-y-1">
      <select value={source} onChange={e => onSourceChange(e.target.value)}
        className="w-full rounded-lg border px-2 py-2 text-[11px]"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}>
        <option value="DIRECT">Directa</option><option value="OTA">OTA (conectar channel manager)</option><option value="MANUAL">Manual</option>
      </select>
      <input value={otaCode||""} onChange={e => onOtaChange(e.target.value)}
        placeholder={source==="OTA"?"Código OTA":"Referencia"} className="w-full rounded-lg border px-2 py-2 text-[11px]"
        style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }} />
    </div>
  );
}

// ── CountrySelect: carga países precargados del sistema ──
function CountrySelect({ value, onChange }) {
  const [countries, setCountries] = useState([]);
  useEffect(() => {
    api.get("/geo/countries").then(r => {
      const data = Array.isArray(r.data) && r.data.length ? r.data : [];
      if (!data.length) {
        // fallback estático
        import("../../lib/countries").then(m => setCountries(m.COUNTRIES || []));
      } else {
        setCountries(data);
      }
    }).catch(() => {
      import("../../lib/countries").then(m => setCountries(m.COUNTRIES || []));
    });
  }, []);
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg border px-2.5 py-2 text-xs"
      style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}>
      <option value="">Seleccionar...</option>
      {countries.map(c => {
        const code = typeof c === "string" ? c : c.code || c.Code || "";
        const name = typeof c === "string" ? c : c.name || c.Name || c.label || code;
        return <option key={code||name} value={code||name}>{name}</option>;
      })}
    </select>
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

