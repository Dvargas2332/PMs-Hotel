// src/pages/Management/ManagementPage.jsx
import React, { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import Roles from "./Roles";
import AuditLog from "./AuditLog";

// Frontdesk
import RoomTypes from "./Frontdesk/RoomTypes";
import Rates from "./Frontdesk/RatePlans";
import Contracts from "./Frontdesk/Contracts";

// Resto de módulos (según tu árbol)
import Payments from "./Payments/PaymentMethods";
import Discounts from "./Discounts/Discounts";
import Taxes from "./Taxes/Taxes";
import Printers from "./Printers/Printers";
import Currency from "./Currency/Currency";
import Hotel from "./Hotel/HotelInfo";
import Cashier from "./Cashier/Cashier";
import MealPlans from "./Frontdesk/MealPlans";          // crea este archivo si no existe
import UsersFD from "./UsersFD/UsersFD";
import Invoicing from "./Invoicing/Invoicing";

// Mapa de vistas para evitar switch infinito y errores de escritura
const VIEWS = {
  // Perfiles y permisos
  profileCreation: Roles,
  profilePermissions: Roles,
  usageLog: AuditLog,

  // Frontdesk
  roomTypes: RoomTypes,
  rates: Rates,
  contracts: Contracts,
  paymentMethods: Payments,
  discounts: Discounts,
  taxes: Taxes,
  printers: Printers,
  currency: Currency,
  hotelInfo: Hotel,
  cashClosures: Cashier,
  mealPlans: MealPlans,
  frontdeskUsers: UsersFD,
  billingSystem: Invoicing,
};

export default function ManagementPage() {
  const [selected, setSelected] = useState("profileCreation");

  const menu = [
    {
      title: "Perfiles y Permisos",
      key: "profiles",
      items: [
        { id: "profileCreation", label: "Creación de perfiles" },
        { id: "profilePermissions", label: "Permisos sobre los perfiles" },
        { id: "usageLog", label: "Bitácora de uso de módulos" },
      ],
    },
    {
      title: "Configuración Front Desk",
      key: "frontdesk",
      items: [
        { id: "roomTypes",      label: "1. Tipos de habitaciones y creación de habitaciones" },
        { id: "rates",          label: "2. Tarifarios" },
        { id: "contracts",      label: "3. Contratos (Directos / OTAs)" },
        { id: "paymentMethods", label: "4. Formas de pago" },
        { id: "discounts",      label: "5. Descuentos" },
        { id: "taxes",          label: "6. Impuestos" },
        { id: "printers",       label: "7. Impresoras" },
        { id: "currency",       label: "8. Tipo de moneda" },
        { id: "hotelInfo",      label: "9. Parámetros e información del hotel" },
        { id: "cashClosures",   label: "10. Cierres de caja" },
        { id: "mealPlans",      label: "11. Regímenes de alojamiento" },
        { id: "frontdeskUsers", label: "12. Usuarios y permisos Front Desk" },
        { id: "billingSystem",  label: "13. Facturación" },
      ],
    },
  ];

  // Expansión de grupos
  const selectedGroupKey = useMemo(() => {
    for (const g of menu) if (g.items.some(i => i.id === selected)) return g.key;
    return null;
  }, [menu, selected]);

  const [expanded, setExpanded] = useState(() => new Set(selectedGroupKey ? [selectedGroupKey] : []));
  const toggleGroup = (key) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const renderSection = () => {
    const Comp = VIEWS[selected];
    return Comp ? <Comp /> : <div className="p-6 text-gray-500">Selecciona una opción del menú.</div>;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-72 border-r bg-white shadow-sm flex flex-col">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Gestor de Modulos</h2>
          <p className="text-xs text-gray-500">Módulo de administración</p>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {menu.map(group => {
            const isOpen = expanded.has(group.key);
            return (
              <div key={group.key} className="border-b">
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  aria-expanded={isOpen}
                >
                  <span>{group.title}</span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>

                <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isOpen ? "max-h-[1000px]" : "max-h-0"}`}>
                  <ul className="px-3 py-2 space-y-1">
                    {group.items.map(item => (
                      <li key={item.id}>
                        <button
                          onClick={() => {
                            setSelected(item.id);
                            if (!expanded.has(group.key)) toggleGroup(group.key);
                          }}
                          className={`flex w-full items-center justify-between text-left text-sm rounded-lg px-3 py-2 ${
                            selected === item.id ? "bg-blue-100 text-blue-700 font-medium" : "hover:bg-gray-100 text-gray-700"
                          }`}
                        >
                          <span>{item.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Área principal */}
      <main className="flex-1 overflow-y-auto p-6">{renderSection()}</main>
    </div>
  );
}
