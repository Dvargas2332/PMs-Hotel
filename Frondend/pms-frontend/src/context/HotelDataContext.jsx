import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { api } from "../lib/api";

// Estructuras esperadas:
// settings: { checkIn:'HH:mm:ss', checkOut:'HH:mm:ss', timeZone:'America/Costa_Rica' }
// room: { id: string, title: string, status: 'available'|'occupied'|'dirty'|'blocked'|'maintenance' }
// reservation: { id, roomId, guestName, checkInDate:'YYYY-MM-DD', checkOutDate:'YYYY-MM-DD', status? }

const HotelDataContext = createContext(null);

const STATUS_LABELS = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CHECKED_IN: "Check-in",
  CHECKED_OUT: "Check-out",
  CANCELED: "Cancelada",
};
const mapStatus = (s) => STATUS_LABELS[(s || "").toUpperCase()] || "Pendiente";
const mapRoomStatus = (s) => {
  const code = (s || "").toUpperCase();
  if (code === "OCCUPIED") return "occupied";
  if (code === "CLEANING") return "dirty";
  if (code === "BLOCKED") return "blocked";
  return "available";
};
const mapRoom = (room) => ({
  id: String(room.id),
  number: room.number ?? room.title ?? String(room.id),
  title: room.title ?? room.number ?? String(room.id),
  type: room.type,
  status: mapRoomStatus(room.status),
  rawStatus: room.status,
});
const mapReservation = (r) => {
  const guestName = [r.guest?.firstName, r.guest?.lastName].filter(Boolean).join(" ").trim();
  return {
    id: String(r.id),
    code: r.code,
    roomId: String(r.roomId),
    roomNumber: r.room?.number ?? r.roomId,
    guestId: r.guestId,
    guestName: guestName || r.guestId,
    checkInDate: toYMD(r.checkIn) || toYMD(r.checkInDate),
    checkOutDate: toYMD(r.checkOut) || toYMD(r.checkOutDate),
    adults: r.adults ?? 2,
    children: r.children ?? 0,
    payments: Array.isArray(r.payments) ? r.payments : [],
    channel: r.channel || r.source || "",
    status: mapStatus(r.status),
    rawStatus: r.status,
    createdAt: r.createdAt,
    room: r.room,
    guest: r.guest,
  };
};
const mapGuest = (g) => ({
  ...g,
  name: [g.firstName, g.lastName].filter(Boolean).join(" ").trim(),
});

function toDateTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, ss || 0, 0);
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
const toYMD = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

export function HotelDataProvider({ children }) {
  const [settings, setSettings] = useState({
    checkIn: "15:00:00",
    checkOut: "11:00:00",
    timeZone: "America/Costa_Rica",
  });
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState({ rooms: false, reservations: false, guests: false, action: false });
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  const setLoadingKey = (key, value) => setLoading((s) => ({ ...s, [key]: value }));

  // Helpers ajustes/habitaciones
  const updateSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  const addRoom = useCallback((room) => {
    setRooms((r) => {
      if (!room?.id) return r;
      if (r.some((x) => x.id === String(room.id))) return r;
      return [...r, mapRoom(room)];
    });
  }, []);

  const removeRoom = useCallback((roomId) => {
    setRooms((r) => r.filter((x) => x.id !== String(roomId)));
    setReservations((res) => res.filter((rv) => rv.roomId !== String(roomId)));
  }, []);

  // Helpers reservas (overlaps client-side)
  const canPlaceReservation = useCallback(
    ({ roomId, checkInDate, checkOutDate, ignoreId = null }) => {
      if (!roomId || !checkInDate || !checkOutDate) return false;
      const inDt = toDateTime(checkInDate, settings.checkIn);
      const outDt = toDateTime(checkOutDate, settings.checkOut);

      return !reservations.some((rv) => {
        if (ignoreId && rv.id === ignoreId) return false;
        if (String(rv.roomId) !== String(roomId)) return false;

        const rvIn = toDateTime(rv.checkInDate, settings.checkIn);
        const rvOut = toDateTime(rv.checkOutDate, settings.checkOut);
        return overlaps(inDt, outDt, rvIn, rvOut);
      });
    },
    [reservations, settings.checkIn, settings.checkOut]
  );

  const refreshRooms = useCallback(async () => {
    setLoadingKey("rooms", true);
    try {
      const { data } = await api.get("/rooms");
      if (Array.isArray(data)) setRooms(data.map(mapRoom));
    } catch (err) {
      setError(err);
    } finally {
      setLoadingKey("rooms", false);
    }
  }, []);

  const refreshReservations = useCallback(async () => {
    setLoadingKey("reservations", true);
    try {
      const { data } = await api.get("/reservations");
      if (Array.isArray(data)) setReservations(data.map(mapReservation));
    } catch (err) {
      setError(err);
    } finally {
      setLoadingKey("reservations", false);
    }
  }, []);

  const refreshGuests = useCallback(async (params) => {
    setLoadingKey("guests", true);
    try {
      const { data } = await api.get("/guests", { params });
      if (Array.isArray(data)) setGuests(data.map(mapGuest));
    } catch (err) {
      setError(err);
    } finally {
      setLoadingKey("guests", false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshRooms(), refreshReservations(), refreshGuests()]);
    setInitialized(true);
  }, [refreshRooms, refreshReservations, refreshGuests]);

  const createGuest = useCallback(async ({ firstName, lastName, email, phone }) => {
    setLoadingKey("action", true);
    try {
      const { data } = await api.post("/guests", { firstName, lastName, email, phone });
      const mapped = mapGuest(data);
      setGuests((g) => [mapped, ...g]);
      return mapped;
    } finally {
      setLoadingKey("action", false);
    }
  }, []);

  const updateGuest = useCallback(async (id, payload) => {
    setLoadingKey("action", true);
    try {
      const { data } = await api.put(`/guests/${id}`, payload);
      const mapped = mapGuest(data);
      setGuests((g) => g.map((x) => (x.id === id ? mapped : x)));
      return mapped;
    } finally {
      setLoadingKey("action", false);
    }
  }, []);

  const createReservation = useCallback(
    async ({
      roomId,
      guestId,
      checkInDate,
      checkOutDate,
      adults = 2,
      children = 0,
      code,
      status = "CONFIRMED",
      source = "FRONTDESK",
      channel = "DIRECT",
      ratePlanId,
      price,
      currency,
      paymentMethod,
      depositAmount,
      hotelId,
    }) => {
      setLoadingKey("action", true);
      try {
        const payloadRaw = {
          roomId: Number(roomId) || roomId,
          guestId: Number(guestId) || guestId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          adults: Number(adults) || 0,
          children: Number(children) || 0,
          code: code || `RES-${Date.now()}`,
          status,
          source,
          channel,
          ratePlanId: ratePlanId ? Number(ratePlanId) || ratePlanId : undefined,
          price: price === 0 || price ? Number(price) : undefined,
          currency,
          paymentMethod,
          depositAmount: depositAmount === 0 || depositAmount ? Number(depositAmount) : undefined,
          hotelId,
        };
        const payload = Object.fromEntries(Object.entries(payloadRaw).filter(([, v]) => v !== undefined && v !== ""));
        const { data } = await api.post("/reservations", payload);
        const mapped = mapReservation(data);
        setReservations((list) => [mapped, ...list]);
        return mapped;
      } finally {
        setLoadingKey("action", false);
      }
    },
    []
  );

  const doCheckIn = useCallback(
    async (id, meta) => {
      setLoadingKey("action", true);
      try {
        const { data } = await api.post(`/reservations/${id}/checkin`, meta);
        const mapped = mapReservation(data);
        setReservations((list) => list.map((r) => (r.id === String(id) ? mapped : r)));
        await refreshRooms();
        return mapped;
      } finally {
        setLoadingKey("action", false);
      }
    },
    [refreshRooms]
  );

  const doCheckOut = useCallback(
    async (id, meta) => {
      setLoadingKey("action", true);
      try {
        const { data } = await api.post(`/reservations/${id}/checkout`, meta);
        const mapped = mapReservation(data);
        setReservations((list) => list.map((r) => (r.id === String(id) ? mapped : r)));
        await refreshRooms();
        return mapped;
      } finally {
        setLoadingKey("action", false);
      }
    },
    [refreshRooms]
  );

  const cancelReservation = useCallback(
    async (id) => {
      setLoadingKey("action", true);
      try {
        const { data } = await api.post(`/reservations/${id}/cancel`);
        const mapped = mapReservation(data);
        setReservations((list) => list.map((r) => (r.id === String(id) ? mapped : r)));
        await refreshRooms();
        return mapped;
      } finally {
        setLoadingKey("action", false);
      }
    },
    [refreshRooms]
  );

  useEffect(() => {
    if (initialized) return;
    refreshAll().catch(() => setInitialized(true));
  }, [initialized, refreshAll]);

  const value = useMemo(
    () => ({
      settings,
      rooms,
      reservations,
      guests,
      loading,
      error,
      initialized,
      setSettings,
      setRooms,
      setReservations,
      updateSettings,
      addRoom,
      removeRoom,
      canPlaceReservation,
      refreshRooms,
      refreshReservations,
      refreshGuests,
      refreshAll,
      createReservation,
      doCheckIn,
      doCheckOut,
      cancelReservation,
      createGuest,
      updateGuest,
    }),
    [
      settings,
      rooms,
      reservations,
      guests,
      loading,
      error,
      initialized,
      updateSettings,
      addRoom,
      removeRoom,
      canPlaceReservation,
      refreshRooms,
      refreshReservations,
      refreshGuests,
      refreshAll,
      createReservation,
      doCheckIn,
      doCheckOut,
      cancelReservation,
      createGuest,
      updateGuest,
    ]
  );

  return <HotelDataContext.Provider value={value}>{children}</HotelDataContext.Provider>;
}

export function useHotelData() {
  const ctx = useContext(HotelDataContext);
  if (!ctx) throw new Error("useHotelData debe usarse dentro de <HotelDataProvider>");
  return ctx;
}
