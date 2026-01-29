import React from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, FileText, Boxes, UtensilsCrossed, ScrollText, ChevronRight } from "lucide-react";
import RestaurantUserMenu from "./RestaurantUserMenu";

// Manually adjust tile size:
const LOBBY_TILE_SIZE = "lg"; // "sm" | "md" | "lg"

const Tile = ({ title, desc, icon: Icon, onClick, tone = "lime", size = LOBBY_TILE_SIZE }) => {
  const cardDecor = {
    amber: { border: "border-lime-300", overlay: "from-lime-600/90 to-orange-500/80" },
    lime: { border: "border-lime-300", overlay: "from-lime-500/90 to-emerald-500/80" },
    slate: { border: "border-slate-200", overlay: "from-slate-700/90 to-slate-900/80" },
    emerald: { border: "border-emerald-200", overlay: "from-emerald-600/90 to-emerald-500/80" },
    indigo: { border: "border-indigo-200", overlay: "from-indigo-600/90 to-blue-500/80" },
  };
  const toneDecor = {
    amber: {
      bg: "bg-white",
      iconBg: "bg-white",
      iconText: "text-black",
      watermark: "text-black",
      glow: "shadow-lime-900/25",
    },
    lime: {
      bg: "bg-lime-50",
      iconBg: "bg-white",
      iconText: "text-black",
      watermark: "text-black/50",
      glow: "shadow-lime-900/25",
    },
    slate: {
      bg: "bg-white",
      iconBg: "bg-white",
      iconText: "text-black",
      watermark: "text-black",
      glow: "shadow-slate-950/30",
    },
    emerald: {
      bg: "bg-white",
      iconBg: "bg-white",
      iconText: "text-black",
      watermark: "text-black",
      glow: "shadow-emerald-900/25",
    },
    indigo: {
      bg: "bg-white",
      iconBg: "bg-white",
      iconText: "text-black",
      watermark: "text-black",
      glow: "shadow-indigo-900/25",
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
      root: "px-4 py-8 min-h-[176px]",
      iconWrap: "h-12 w-12 rounded-2xl",
      icon: "w-6 h-6",
      title: "text-xl",
      desc: "text-sm mt-2.5",
      chevron: "w-6 h-6",
    },
  };
  const s = sizes[size] || sizes.md;
  const c = cardDecor[tone] || cardDecor.amber;
  const d = toneDecor[tone] || toneDecor.amber;

  return (
    <button
      className={`group relative overflow-hidden rounded-2xl border ${c.border} ${d.bg || "bg-white"} shadow-sm text-left ${s.root} hover:shadow-md transition`}
      onClick={onClick}
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
            <div className={`${s.title} font-semibold text-black`}>{title}</div>
          </div>
          <div className={`${s.desc} text-black`}>{desc}</div>
        </div>
        <ChevronRight className={`${s.chevron} text-black group-hover:translate-x-0.5 transition`} />
      </div>
    </button>
  );
};

export default function RestaurantLobby() {
  const navigate = useNavigate();
  const tiles = [
    {
      title: "Restaurante (POS)",
      desc: "Mesas, comandas, cobro y cierre de orden.",
      icon: UtensilsCrossed,
      onClick: () => navigate("/restaurant/pos"),
      tone: "lime",
    },
    {
      title: "Comandas (KDS Cocina/Bar)",
      desc: "Pantalla de cocina y bar con estados de preparacion.",
      icon: ScrollText,
      onClick: () => navigate("/restaurant/kds"),
      tone: "emerald",
    },
    {
      title: "Historicos",
      desc: "Facturacion e informes en un solo lugar.",
      icon: FileText,
      onClick: () => navigate("/restaurant/reports"),
      tone: "indigo",
    },
    {
      title: "Cierres",
      desc: "Cierres de caja del restaurante y conciliacion.",
      icon: ClipboardList,
      onClick: () => navigate("/restaurant/closes"),
      tone: "slate",
    },
    {
      title: "Inventario",
      desc: "Inventario y recetario (configuracion).",
      icon: Boxes,
      onClick: () => navigate("/management?view=restaurantInventory"),
      tone: "slate",
    },
    {
      title: "Reimpresiones",
      desc: "Reimpresiones, anulaciones y re-Reimpresiones.",
      icon: FileText,
      onClick: () => navigate("/restaurant/billing"),
      tone: "amber",
    },
  ];
  const gridCols =
    LOBBY_TILE_SIZE === "lg"
      ? "md:grid-cols-2 lg:grid-cols-3"
      : LOBBY_TILE_SIZE === "sm"
        ? "md:grid-cols-3 lg:grid-cols-4"
        : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="min-h-screen bg-gradient-to-b from-lime-50 to-white text-black">
      <header className="h-14 flex items-center justify-between px-6 bg-white/90 backdrop-blur border-b border-slate-200 text-black shadow">
        <div>
          <div className="text-xs uppercase text-black/80">Restaurant</div>
          <div className="text-sm font-semibold">Lobby</div>
        </div>
        <div className="flex items-center gap-2">
          <RestaurantUserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="text-black">
          <div className="text-2xl font-semibold">Point of Sale dashboard</div>
          <div className="text-sm text-black">Choose where you want to go.</div>
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









