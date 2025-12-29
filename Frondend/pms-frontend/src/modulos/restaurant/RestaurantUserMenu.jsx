import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleUser, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function RestaurantUserMenu() {
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
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-semibold"
        onClick={() => setOpen((s) => !s)}
      >
        <CircleUser className="w-5 h-5" />
        <span className="hidden sm:inline">{user?.name || user?.email || "User"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-48 bg-white text-amber-900 rounded-lg shadow-lg border">
          <div className="px-3 py-2 text-sm border-b">
            <div className="font-semibold">{user?.name || "User"}</div>
            <div className="text-xs text-amber-700/80">{user?.email || user?.username || ""}</div>
          </div>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-amber-50"
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
