import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, UtensilsCrossed, ScrollText, ChevronRight, Users, BarChart3, CircleUserRound } from "lucide-react";
import RestaurantUserMenu from "./RestaurantUserMenu";

// Manually adjust tile size:
const LOBBY_TILE_SIZE = "lg"; // "sm" | "md" | "lg"

export const Tile = ({ title, desc, icon: Icon, onClick, tone = "lime", size = LOBBY_TILE_SIZE, actions }) => {
  const toneDecor = {
    lime: {
      border: "border-lime-200",
      iconBg: "bg-lime-700",
      iconText: "text-white",
      watermark: "text-lime-200/60",
      glow: "shadow-emerald-500/20",
    },
    emerald: {
      border: "border-emerald-200",
      iconBg: "bg-emerald-600",
      iconText: "text-white",
      watermark: "text-emerald-200/60",
      glow: "shadow-emerald-500/20",
    },
    indigo: {
      border: "border-lime-200",
      iconBg: "bg-lime-700",
      iconText: "text-white",
      watermark: "text-lime-200/60",
      glow: "shadow-emerald-500/20",
    },
    orange: {
      border: "border-emerald-200",
      iconBg: "bg-emerald-600",
      iconText: "text-white",
      watermark: "text-emerald-200/60",
      glow: "shadow-emerald-500/20",
    },
    aqua: {
      border: "border-lime-200",
      iconBg: "bg-lime-700",
      iconText: "text-white",
      watermark: "text-lime-200/60",
      glow: "shadow-emerald-500/20",
    },
    amber: {
      border: "border-amber-300",
      iconBg: "bg-amber-500",
      iconText: "text-white",
      watermark: "text-amber-300/60",
      glow: "shadow-amber-400/30",
    },
  };

  const sizes = {
    sm: {
      root: "px-3 py-5 min-h-[128px]",
      iconWrap: "h-9 w-9 rounded-lg",
      icon: "w-4 h-4",
      title: "text-base",
      desc: "text-xs mt-1.5",
      chevron: "w-4 h-4",
    },
    md: {
      root: "px-4 py-7 min-h-[156px]",
      iconWrap: "h-10 w-10 rounded-xl",
      icon: "w-5 h-5",
      title: "text-lg",
      desc: "text-sm mt-2",
      chevron: "w-5 h-5",
    },
    lg: {
      root: "px-4 py-8 min-h-[186px]",
      iconWrap: "h-20 w-20 rounded-3xl",
      icon: "w-10 h-10",
      title: "text-xl",
      desc: "text-sm mt-2.5",
      chevron: "w-10 h-10",
    },
  };
  const s = sizes[size] || sizes.md;
  const d = toneDecor[tone] || toneDecor.lime;

  const Root = actions?.length ? "div" : "button";
  return (
    <Root
      className={`group relative overflow-hidden rounded-2xl bg-white/95 border ${d.border} shadow-[0_8px_20px_rgba(16,185,129,0.18)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.28)] hover:-translate-y-0.5 transition text-left ${s.root}`}
      onClick={actions?.length ? undefined : onClick}
      type={actions?.length ? undefined : "button"}
    >
      <div className="absolute -top-6 -right-6 pointer-events-none">
        <Icon className={`w-28 h-28 ${d.watermark}`} />
      </div>
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className={`${s.iconWrap} ${d.iconBg} shadow-lg ${d.glow} flex items-center justify-center`}>
              <Icon className={`${s.icon} ${d.iconText}`} />
            </div>
            <div className={`${s.title} font-semibold text-lime-900`}>{title}</div>
          </div>
          <div className={`${s.desc} text-slate-600`}>{desc}</div>
          {actions?.length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="px-3 py-2 rounded-lg border border-lime-200 bg-white text-sm font-semibold text-lime-900 hover:bg-lime-50"
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!actions?.length && (
          <ChevronRight className={`${s.chevron} text-lime-700 group-hover:translate-x-0.5 transition`} />
        )}
      </div>
    </Root>
  );
};

export default function RestaurantLobby() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const shift = useMemo(() => {
    const h = now.getHours();
    if (h < 15) return "Morning shift";
    if (h < 22) return "Afternoon shift";
    return "Night shift";
  }, [now]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const tiles = [
    {
      title: "Restaurante (POS)",
      desc: "Mesas, comandas, cobro y cierre de orden.",
      icon: UtensilsCrossed,
      size: "lg",
      onClick: () => navigate("/restaurant/pos"),
      tone: "lime",
    },
    {
      title: "Comandas (KDS Cocina/Bar)",
      desc: "Pantalla de cocina y bar con estados de preparacion.",
      icon: ScrollText,
      size: "lg",
      onClick: () => navigate("/restaurant/kds"),
      tone: "emerald",
    },
    {
      title: "Cajeros y Meseros",
      desc: "Crea y administra personal con acceso al TPV.",
      icon: Users,
      size: "lg",
      onClick: () => navigate("/restaurant/staff"),
      tone: "emerald",
    },
    {
      title: "Inventario",
      desc: "Inventario y recetario (configuracion).",
      icon: Boxes,
      size: "lg",
      onClick: () => navigate("/management?view=restaurantInventory"),
      tone: "orange",
    },
    {
      title: "Historicos / Estadisticas",
      desc: "Reportes, cierres y control operativo.",
      icon: BarChart3,
      size: "lg",
      onClick: () => navigate("/restaurant/history"),
      tone: "indigo",
    },
    {
      title: "Clientes",
      desc: "Crear y editar clientes compartidos con Front Desk.",
      icon: CircleUserRound,
      size: "lg",
      onClick: () => navigate("/restaurant/clients"),
      tone: "emerald",
    },
  ];
  const gridCols =
    LOBBY_TILE_SIZE === "lg"
      ? "md:grid-cols-2 lg:grid-cols-3"
      : LOBBY_TILE_SIZE === "sm"
        ? "md:grid-cols-3 lg:grid-cols-4"
        : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-200 text-black">
      <header className="relative h-14 bg-gradient-to-r from-lime-700 to-emerald-600 flex items-center justify-between px-10 shadow">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-white">Restaurant Lobby</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-sm font-semibold">
            <div className="px-4 py-2 rounded-xl bg-white/15 text-white">
              {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/15 text-white">{shift}</div>
          </div>
          <RestaurantUserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="text-black">
          <div className="text-2xl font-semibold">Point of Sale dashboard</div>
        </div>

        <div className={`grid gap-4 ${gridCols}`}>
          {tiles.map((t) => (
            <Tile key={t.title} {...t} />
          ))}
        </div>
      </div>
    </div>
  );
}


