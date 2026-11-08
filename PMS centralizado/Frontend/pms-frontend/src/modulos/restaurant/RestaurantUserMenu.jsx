import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CircleUser, LogOut, Wallet, LayoutGrid } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// Mismo botón de usuario que usa Facturación electrónica: ícono, nombre y rol en
// una línea, y el desplegable con la ficha arriba y las acciones debajo.
// `onDark` es para las cabeceras con degradado verde; el KDS tiene cabecera
// blanca y pasa false.
export default function RestaurantUserMenu({ onOpenCashStatus, onDark = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pathname = String(location?.pathname || "");
  const isLobbyRoute = pathname === "/restaurant" || pathname === "/restaurant/";

  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const displayName = user?.name || user?.email || "Usuario";
  const displayRole = user?.role || "Restaurante";
  const itemClass =
    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10";

  return (
    <div className="relative" ref={ref}>
      <button
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
          onDark ? "bg-white/15 text-white hover:bg-white/25" : "text-slate-800 hover:bg-black/5"
        }`}
        onClick={() => setOpen((s) => !s)}
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <CircleUser className="w-5 h-5 shrink-0" style={{ opacity: 0.9 }} />
        <div className="text-left text-sm leading-tight hidden sm:block">
          <div className="font-medium">{displayName}</div>
          <div className="text-xs" style={{ opacity: 0.8 }}>{displayRole}</div>
        </div>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 shadow-xl rounded-2xl overflow-hidden z-50"
          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <div className="px-3 py-2 text-sm" style={{ borderBottom: "1px solid var(--card-border)" }}>
            <div className="font-semibold" style={{ color: "var(--color-text-base)" }}>{displayName}</div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.email || user?.username || ""}</div>
          </div>
          {typeof onOpenCashStatus === "function" && (
            <button
              className={itemClass}
              style={{ color: "var(--color-text-muted)" }}
              onClick={() => {
                setOpen(false);
                onOpenCashStatus();
              }}
            >
              <Wallet className="w-4 h-4" />
              <span>Estado de caja</span>
            </button>
          )}
          {!isLobbyRoute && (
            <button
              className={itemClass}
              style={{ color: "var(--color-text-muted)" }}
              onClick={() => {
                setOpen(false);
                navigate("/restaurant");
              }}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Lobby</span>
            </button>
          )}
          <button
            className={itemClass}
            style={{ color: "var(--color-text-muted)" }}
            onClick={() => {
              setOpen(false);
              navigate("/launcher");
            }}
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
