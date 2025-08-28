// src/modulos/management/sections/settings/SettingsHome.jsx
import { Link, useLocation } from "react-router-dom";

function Card({ to, title, desc, active }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={[
        "block rounded-xl border bg-white p-4 transition",
        "hover:shadow focus:outline-none focus:ring-2 focus:ring-green-600",
        active ? "ring-2 ring-green-700" : "hover:border-gray-300",
      ].join(" ")}
    >
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-gray-500">{desc}</div>
    </Link>
  );
}

export default function SettingsHome() {
  const { pathname } = useLocation();

  const items = [
    {
      to: "/management/settings/users",
      title: "Users",
      desc: "Permisos, acceso a módulos y tareas.",
      // cualquier ruta que empiece con /management/settings/users se considera activa
      isActive: pathname.startsWith("/management/settings/users"),
    },
    {
      to: "/management/frontdesk",
      title: "Front Desk",
      desc: "Rooms, tarifas, impresoras, moneda…",
      isActive: pathname.startsWith("/management/frontdesk"),
    },
    {
      to: "/management/restaurant",
      title: "Restaurant",
      desc: "Impuestos, menús, impresión, etc.",
      isActive: pathname.startsWith("/management/restaurant"),
    },
    {
      to: "/management/accounting",
      title: "Accounting",
      desc: "Moneda, impuestos y parámetros contables.",
      isActive: pathname.startsWith("/management/accounting"),
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="settings-title">
      <header>
        <h1 id="settings-title" className="text-2xl font-bold">
          Settings
        </h1>
        <p className="text-sm text-gray-500">
          Configura usuarios, Front Desk, Restaurant y Accounting.
        </p>
      </header>

      <nav aria-label="Settings sections">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <li key={it.to}>
              <Card to={it.to} title={it.title} desc={it.desc} active={it.isActive} />
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
