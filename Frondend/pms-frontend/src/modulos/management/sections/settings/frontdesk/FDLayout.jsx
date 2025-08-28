// src/modulos/management/sections/settings/frontdesk/FDLayout.jsx
import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "rooms", label: "Rooms" },
  { to: "rates", label: "Rates" },
  { to: "printers", label: "Printers" },
  { to: "currency", label: "Currency" },
];

export default function FDLayout() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Front Desk</h2>
      <div className="flex gap-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded ${isActive ? "bg-slate-800 text-white" : "bg-gray-200"}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
