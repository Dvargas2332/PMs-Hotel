// src/modulos/management/components/ManagementTabs.jsx
import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/management", label: "Settings", end: true }, // landing de configuración
  { to: "/management/frontdesk", label: "Front Desk" },
  { to: "/management/restaurant", label: "Restaurant" },
  { to: "/management/accounting", label: "Accounting" },
];

export default function ManagementTabs() {
  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `px-3 py-2 rounded ${isActive ? "bg-green-700 text-white" : "bg-gray-200"}`
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

