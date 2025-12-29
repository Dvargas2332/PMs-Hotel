import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  FileText,
  Boxes,
  UtensilsCrossed,
  ScrollText,
  ChevronRight,
} from "lucide-react";
import RestaurantUserMenu from "./RestaurantUserMenu";

// Manually adjust tile size:
const LOBBY_TILE_SIZE = "lg"; // "sm" | "md" | "lg"

const Tile = ({ title, desc, icon: Icon, onClick, tone = "amber", size = LOBBY_TILE_SIZE }) => {
  const cardDecor = {
    amber: { border: "border-amber-200", overlay: "from-amber-600/90 to-orange-500/80" },
    slate: { border: "border-slate-200", overlay: "from-slate-700/90 to-slate-900/80" },
    emerald: { border: "border-emerald-200", overlay: "from-emerald-600/90 to-emerald-500/80" },
    indigo: { border: "border-indigo-200", overlay: "from-indigo-600/90 to-blue-500/80" },
  };
  const toneDecor = {
    amber: {
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
      iconText: "text-white",
      watermark: "text-amber-600/20",
      glow: "shadow-amber-900/25",
    },
    slate: {
      iconBg: "bg-gradient-to-br from-slate-700 to-slate-950",
      iconText: "text-white",
      watermark: "text-slate-600/20",
      glow: "shadow-slate-950/30",
    },
    emerald: {
      iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-700",
      iconText: "text-white",
      watermark: "text-emerald-600/20",
      glow: "shadow-emerald-900/25",
    },
    indigo: {
      iconBg: "bg-gradient-to-br from-indigo-500 to-blue-600",
      iconText: "text-white",
      watermark: "text-indigo-600/20",
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
      className={`group relative overflow-hidden rounded-2xl border ${c.border} bg-white shadow-sm text-left ${s.root} hover:shadow-md transition`}
      onClick={onClick}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${c.overlay} opacity-10`} />
      <div className="absolute -top-6 -right-6 pointer-events-none">
        <Icon className={`w-28 h-28 ${d.watermark}`} />
      </div>
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className={`${s.iconWrap} ${d.iconBg} shadow-lg ${d.glow} flex items-center justify-center`}>
              <Icon className={`${s.icon} ${d.iconText}`} />
            </div>
            <div className={`${s.title} font-semibold text-slate-900`}>{title}</div>
          </div>
          <div className={`${s.desc} text-slate-700`}>{desc}</div>
        </div>
        <ChevronRight className={`${s.chevron} text-slate-500 group-hover:translate-x-0.5 transition`} />
      </div>
    </button>
  );
};

export default function RestaurantLobby() {
  const navigate = useNavigate();
  const gridCols =
    LOBBY_TILE_SIZE === "lg"
      ? "md:grid-cols-2 lg:grid-cols-3"
      : LOBBY_TILE_SIZE === "sm"
        ? "md:grid-cols-3 lg:grid-cols-4"
        : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <header className="h-14 flex items-center justify-between px-6 bg-gradient-to-r from-amber-700 to-slate-800 text-white shadow">
        <div>
          <div className="text-xs uppercase text-amber-200/80">Restaurant</div>
          <div className="text-sm font-semibold">Lobby</div>
        </div>
        <div className="flex items-center gap-2">
          <RestaurantUserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="text-white">
          <div className="text-2xl font-semibold">Point of Sale dashboard</div>
          <div className="text-sm text-amber-100/70">Choose where you want to go.</div>
        </div>

        <div className={`grid gap-4 ${gridCols}`}>
          <Tile
            title="Restaurant (POS)"
          
            desc="Tables, orders, payment, and order closing."
            icon={UtensilsCrossed}
            onClick={() => navigate("/restaurant/pos")}
            tone="amber"
          />
          <Tile
            title="Orders (KDS Kitchen/Bar)"
            desc="Kitchen and bar screen with preparation statuses."
            icon={ScrollText}
            onClick={() => navigate("/restaurant/kds")}
            tone="emerald"
          />
          <Tile
            title="Reports"
            desc="Restaurant KPIs and reports."
            icon={FileText}
            onClick={() => navigate("/restaurant/reports")}
            tone="indigo"
          />
          <Tile
            title="Closures"
            desc="Restaurant cash closures and reconciliation."
            icon={ClipboardList}
            onClick={() => navigate("/restaurant/closes")}
            tone="slate"
          />
          <Tile
            title="Inventory"
            desc="Inventory and recipes (configuration)."
            icon={Boxes}
            onClick={() => navigate("/management?view=restaurantConfig&tab=inventory")}
            tone="slate"
          />
          <Tile
            title="Billing"
            desc="Reprints, voids and re-invoicing (history)."
            icon={FileText}
            onClick={() => navigate("/restaurant/billing")}
            tone="amber"
          />
        </div>
      </div>
    </div>
  );
}
