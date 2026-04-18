import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleUser, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

export default function EInvoicingUserMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
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
        <span className="hidden sm:inline">{user?.name || user?.email || t("einv.userFallback")}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-56 bg-slate-800 border border-white/10 shadow-xl rounded-2xl overflow-hidden z-50">
          <div className="px-3 py-2 text-sm border-b border-white/10">
            <div className="font-semibold text-white">{user?.name || t("einv.userFallback")}</div>
            <div className="text-xs text-slate-400">{user?.email || user?.username || ""}</div>
          </div>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white text-left transition-colors"
            onClick={() => { setOpen(false); navigate("/launcher"); }}
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span>{t("common.logout")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
