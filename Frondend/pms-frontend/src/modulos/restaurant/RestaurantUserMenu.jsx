import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleUser, LogOut, MoreVertical } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function RestaurantUserMenu({ onOpenCashStatus }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center justify-center w-12 h-12 rounded-full bg-lime-100 hover:bg-lime-200 text-lime-900"
        onClick={() => setOpen((s) => !s)}
        aria-label="User menu"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-60 bg-white text-black rounded-lg shadow-lg border overflow-hidden">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-lime-50 hover:bg-lime-100"
            onClick={() => setOpen(false)}
          >
            <CircleUser className="w-5 h-5" />
            <div className="text-left">
              <div>{user?.name || user?.email || "User"}</div>
              <div className="text-xs font-normal text-slate-600">{user?.email || user?.username || ""}</div>
            </div>
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-lime-50"
            onClick={() => {
              setOpen(false);
              navigate("/restaurant");
            }}
          >
            <span>Lobby</span>
          </button>
          {typeof onOpenCashStatus === "function" && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-lime-50"
              onClick={() => {
                setOpen(false);
                onOpenCashStatus();
              }}
            >
              <span>Estado de caja</span>
            </button>
          )}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-lime-50"
            onClick={() => {
              setOpen(false);
              navigate("/launcher");
            }}
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
