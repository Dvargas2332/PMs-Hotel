// Copyright (c) 2025 Diego Vargas. Todos los derechos reservados.
// Uso, copia, modificación o distribución prohibidos sin autorización por escrito.




import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

// Estructuras:
// settings: { checkIn:'HH:mm:ss', checkOut:'HH:mm:ss', timeZone:'America/Costa_Rica' }
// room: { id: string, title: string }
// reservation: { id, roomId, guestName, checkInDate:'YYYY-MM-DD', checkOutDate:'YYYY-MM-DD', status? }

const HotelDataContext = createContext(null);

function toDateTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, ss || 0, 0);
}
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd; // verdadero solapamiento (permite turnover)
}

export function HotelDataProvider({ children }) {
  // Configuración global
  const [settings, setSettings] = useState({
    checkIn: "15:00:00",
    checkOut: "11:00:00",
    timeZone: "America/Costa_Rica",
  });

  // Habitaciones demo
  const [rooms, setRooms] = useState([
    { id: "101", title: "101" },
    { id: "102", title: "102" },
    { id: "103", title: "103" },
    { id: "104", title: "104" },
    { id: "105", title: "105" },
  ]);

  // Reservas demo (incluye turnover mismo día en 101)
  const [reservations, setReservations] = useState([
    { id: "res-101-A", roomId: "101", guestName: "Ana Rodríguez", checkInDate: "2025-08-25", checkOutDate: "2025-08-26" },
    { id: "res-101-B", roomId: "101", guestName: "Luis García", checkInDate: "2025-08-26", checkOutDate: "2025-08-28" },
    { id: "res-102",   roomId: "102", guestName: "María López",   checkInDate: "2025-08-27", checkOutDate: "2025-08-30" },
  ]);

  // === Helpers ajustes/habitaciones ===
  const updateSettings = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const addRoom = useCallback((room) => {
    setRooms((r) => {
      if (!room?.id) return r;
      if (r.some((x) => x.id === String(room.id))) return r;
      return [...r, { id: String(room.id), title: String(room.title ?? room.id) }];
    });
  }, []);

  const removeRoom = useCallback((roomId) => {
    setRooms((r) => r.filter((x) => x.id !== String(roomId)));
    setReservations((res) => res.filter((rv) => rv.roomId !== String(roomId)));
  }, []);

  // === Helpers reservas ===
  const canPlaceReservation = useCallback(
    ({ roomId, checkInDate, checkOutDate, ignoreId = null }) => {
      if (!roomId || !checkInDate || !checkOutDate) return false;
      const inDt  = toDateTime(checkInDate, settings.checkIn);
      const outDt = toDateTime(checkOutDate, settings.checkOut);

      return !reservations.some((rv) => {
        if (ignoreId && rv.id === ignoreId) return false;
        if (String(rv.roomId) !== String(roomId)) return false;

        const rvIn  = toDateTime(rv.checkInDate, settings.checkIn);
        const rvOut = toDateTime(rv.checkOutDate, settings.checkOut);
        return overlaps(inDt, outDt, rvIn, rvOut); // true -> bloquea
      });
    },
    [reservations, settings.checkIn, settings.checkOut]
  );

  const value = useMemo(
    () => ({
      // estado
      settings, rooms, reservations,
      // setters CRUD
      setSettings, setRooms, setReservations,
      // helpers de administración
      updateSettings, addRoom, removeRoom,
      // helpers de reservas
      canPlaceReservation,
    }),
    [settings, rooms, reservations, updateSettings, addRoom, removeRoom, canPlaceReservation]
  );

  return <HotelDataContext.Provider value={value}>{children}</HotelDataContext.Provider>;
}

export function useHotelData() {
  const ctx = useContext(HotelDataContext);
  if (!ctx) {
    throw new Error("useHotelData debe usarse dentro de <HotelDataProvider>");
  }
  return ctx;
}
