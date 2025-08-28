// src/modulos/management/sections/settings/users/UsersLayout.jsx
import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "permissions", label: "Permissions" },
  { to: "modules", label: "Modules access" },
  { to: "tasks", label: "Tasks" },
];

export default function UsersLayout() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Users</h2>
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
