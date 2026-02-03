import React from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, FileText, Boxes, UtensilsCrossed, ScrollText, ChevronRight } from "lucide-react";
import RestaurantUserMenu from "./RestaurantUserMenu";

// Manually adjust tile size:
const LOBBY_TILE_SIZE = "lg"; // "sm" | "md" | "lg"

const Tile = ({ title, desc, icon: Icon, onClick, tone = "lime", size = LOBBY_TILE_SIZE }) => {
  const cardDecor = {
    aqua: { border: "border-black/20", overlay: "from-black/10 to-black/5" },
    lime: { border: "border-black/20", overlay: "from-black/10 to-black/5" },
    orange: { border: "border-black/20", overlay: "from-black/10 to-black/5" },
    emerald: { border: "border-black/20", overlay: "from-black/10 to-black/5" },
    indigo: { border: "border-black/20", overlay: "from-black/10 to-black/5" },
  };
  const toneDecor = {

    lime: {
      bg: "bg-white",
      iconBg: "bg-black",
      iconText: "text-white",
      watermark: "text-black/10",
      glow: "shadow-black/20",
    },

    emerald: {
      bg: "bg-white",
      iconBg: "bg-black",
      iconText: "text-white",
      watermark: "text-black/10",
      glow: "shadow-black/20",
    },

    indigo: {
      bg: "bg-white",
      iconBg: "bg-black",
      iconText: "text-white",
      watermark: "text-black/10",
      glow: "shadow-black/20",
    },

    orange: {
      bg: "bg-white",
      iconBg: "bg-black",
      iconText: "text-white",
      watermark: "text-black/10",
      glow: "shadow-black/20",
    },
    
    aqua: {
      bg: "bg-white",
      iconBg: "bg-black",
      iconText: "text-white",
      watermark: "text-black/10",
      glow: "shadow-black/20",
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
  const c = cardDecor[tone] || cardDecor.aqua;
  const d = toneDecor[tone] || toneDecor.aqua;

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
      title: "Historicos",
      desc: "Facturacion e informes en un solo lugar.",
      icon: FileText,
      size: "lg",
      onClick: () => navigate("/restaurant/reports"),
      tone: "indigo",
    },
    {
      title: "Cierres",
      desc: "Cierres de caja del restaurante y conciliacion.",
      icon: ClipboardList,
      size: "lg",
      onClick: () => navigate("/restaurant/closes"),
      tone: "orange",
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
      title: "Reimpresiones",
      desc: "Reimpresiones, anulaciones y re-Reimpresiones.",
      icon: FileText,
      size: "lg",
      onClick: () => navigate("/restaurant/billing"),
      tone: "aqua",
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
      <header className="h-14 flex items-center justify-between px-6 bg-white/95 backdrop-blur border-b border-black/10 text-black shadow">
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








