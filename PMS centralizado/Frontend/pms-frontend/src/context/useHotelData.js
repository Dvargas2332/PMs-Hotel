import { useContext } from "react";
import { HotelDataContext } from "./HotelDataContext";

export function useHotelData() {
  const ctx = useContext(HotelDataContext);
  if (!ctx) throw new Error("useHotelData debe usarse dentro de <HotelDataProvider>");
  return ctx;
}
