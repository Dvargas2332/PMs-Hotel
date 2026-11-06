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
        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/20 text-sm transition-colors"
        style={{ color: "var(--color-text-base)" }}
        onClick={() => setOpen((s) => !s)}
      >
        <CircleUser className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
        <div className="text-left text-sm leading-tight hidden sm:block">
          <div className="font-medium" style={{ color: "var(--color-text-base)" }}>{user?.name || user?.email || t("einv.userFallback")}</div>
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.role || "Facturación"}</div>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 shadow-xl rounded-2xl overflow-hidden z-50" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="px-3 py-2 text-sm" style={{ borderBottom: "1px solid var(--card-border)" }}>
            <div className="font-semibold" style={{ color: "var(--color-text-base)" }}>{user?.name || t("einv.userFallback")}</div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user?.email || user?.username || ""}</div>
          </div>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: "var(--color-text-muted)" }}
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
