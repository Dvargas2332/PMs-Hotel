// src/pages/Management/ManagementPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Bell, CircleUser, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Roles from "./Roles";
import AuditLog from "./AuditLog";

// Frontdesk
import RoomTypes from "./Frontdesk/RoomTypes";
import Rates from "./Frontdesk/RatePlans";
import Contracts from "./Frontdesk/Contracts";
import MealPlans from "./Frontdesk/MealPlans";

// Other modules
import Payments from "./Payments/PaymentMethods";
import Discounts from "./Discounts/Discounts";
import Taxes from "./Taxes/Taxes";
import Printers from "./Printers/Printers";
import Currency from "./Currency/Currency";
import Hotel from "./Hotel/HotelInfo";
import Cashier from "./Cashier/Cashier";
import UsersFD from "./UsersFD/UsersFD";
import Invoicing from "./Invoicing/Invoicing";
import AccountingConfig from "./SomeModule/AccountingConfig";
import RestaurantConfig from "./SomeModule/RestaurantConfig";
import ChannelManager from "./SomeModule/ChannelManager";
import { useAuth } from "../../context/AuthContext";
import RestaurantGeneral from "./Restaurant/RestaurantGeneral";
import RestaurantBilling from "./Restaurant/RestaurantBilling";
import RestaurantTaxes from "./Restaurant/RestaurantTaxes";
import RestaurantPayments from "./Restaurant/RestaurantPayments";
import RestaurantFamilies from "./Restaurant/RestaurantFamilies";
import RestaurantRecipes from "./Restaurant/RestaurantRecipes";
import RestaurantInventory from "./Restaurant/RestaurantInventory";
import RestaurantItems from "./Restaurant/RestaurantItems";

const VIEWS = {
  // Profiles
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

  // Accounting
  accountingConfig: AccountingConfig,

  // Restaurant
  restaurantGeneral: RestaurantGeneral,
  restaurantBilling: RestaurantBilling,
  restaurantTaxes: RestaurantTaxes,
  restaurantPayments: RestaurantPayments,
  restaurantFamilies: RestaurantFamilies,
  restaurantRecipes: RestaurantRecipes,
  restaurantInventory: RestaurantInventory,
  restaurantItems: RestaurantItems,
  restaurantConfig: RestaurantConfig,

  // Channel manager
  channelManager: ChannelManager,
};

export default function ManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selected, setSelected] = useState("profileCreation");
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menusRef = useRef(null);
  const [pendingGeneralSave, setPendingGeneralSave] = useState(false);

  // Escucha eventos globales de alertas para mantener consistencia con el resto del app
  useEffect(() => {
    const onToggle = () => setAlertsOpen((v) => !v);
    const onOpen = () => setAlertsOpen(true);
    const onClose = () => setAlertsOpen(false);
    const onSet = (e) => setAlerts(Array.isArray(e.detail) ? e.detail : []);
    const onPush = (e) => {
      const item = e.detail;
      if (!item) return;
      setAlerts((prev) => [{ id: item.id || crypto.randomUUID?.() || Date.now(), ...item }, ...prev]);
      setAlertsOpen(true);
    };
    const onClear = () => setAlerts([]);

    window.addEventListener("pms:toggle-alerts", onToggle);
    window.addEventListener("pms:open-alerts", onOpen);
    window.addEventListener("pms:close-alerts", onClose);
    window.addEventListener("pms:set-alerts", onSet);
    window.addEventListener("pms:push-alert", onPush);
    window.addEventListener("pms:clear-alerts", onClear);

    const onDocClick = (e) => {
      if (!alertsOpen && !userMenuOpen) return;
      if (menusRef.current && !menusRef.current.contains(e.target)) {
        setAlertsOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);

    return () => {
      window.removeEventListener("pms:toggle-alerts", onToggle);
      window.removeEventListener("pms:open-alerts", onOpen);
      window.removeEventListener("pms:close-alerts", onClose);
      window.removeEventListener("pms:set-alerts", onSet);
      window.removeEventListener("pms:push-alert", onPush);
      window.removeEventListener("pms:clear-alerts", onClear);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [alertsOpen, userMenuOpen]);

  const handleLogout = () => {
    // Mantiene sesión y regresa al launcher
    navigate("/launcher");
  };

  const handleGeneralInfo = () => {
    setSelected("hotelInfo");
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add("frontdesk");
      return next;
    });
    setPendingGeneralSave(true);
  };

  useEffect(() => {
    if (pendingGeneralSave && selected === "hotelInfo") {
      window.dispatchEvent(new CustomEvent("pms:save-hotel-info"));
      setPendingGeneralSave(false);
    }
  }, [pendingGeneralSave, selected]);

  const menu = useMemo(
    () => [
      {
        title: "Usuarios",
        key: "profiles",
        items: [{ id: "profileCreation", label: "Perfiles y permisos" }],
      },
      {
        title: "Auditoria",
        key: "audit",
        items: [{ id: "usageLog", label: "Bitacora de uso de modulos" }],
      },
      {
        title: "Front Desk",
        key: "frontdesk",
        items: [
          { id: "roomTypes",      label: "1. Tipos de habitaciones y creacion de habitaciones" },
          { id: "rates",          label: "2. Tarifarios" },
          { id: "contracts",      label: "3. Contratos (Directos / OTAs)" },
          { id: "paymentMethods", label: "4. Formas de pago" },
          { id: "discounts",      label: "5. Descuentos" },
          { id: "taxes",          label: "6. Impuestos" },
          { id: "printers",       label: "7. Impresoras" },
          { id: "currency",       label: "8. Tipo de moneda" },
          { id: "hotelInfo",      label: "9. Parametros e informacion del hotel" },
          { id: "cashClosures",   label: "10. Cierres de caja" },
          { id: "mealPlans",      label: "11. Regimenes de alojamiento" },
          { id: "billingSystem",  label: "12. Facturacion" },
        ],
      },
      {
        title: "Restaurante",
        key: "restaurant",
        items: [
          { id: "restaurantGeneral", label: "Informacion general" },
          { id: "restaurantBilling", label: "Facturacion" },
          { id: "restaurantTaxes", label: "Impuestos y descuentos" },
          { id: "restaurantPayments", label: "Pagos y divisa" },
          { id: "restaurantFamilies", label: "Grupos y familias" },
          { id: "restaurantItems", label: "Articulos" },
          { id: "restaurantRecipes", label: "Recetario" },
          { id: "restaurantInventory", label: "Inventario" },
          { id: "restaurantConfig", label: "Secciones, mesas y menu" },
        ],
      },
      {
        title: "Accounting",
        key: "accounting",
        items: [
          { id: "accountingConfig", label: "Parametros contables" },
          { id: "billingSystem", label: "Facturacion electronica" },
        ],
      },
      {
        title: "Channel Manager",
        key: "channel",
        items: [{ id: "channelManager", label: "Conexion OTAs / Channel Manager" }],
      },
    ],
    []
  );

  const selectedGroupKey = useMemo(() => {
    for (const g of menu) if (g.items.some((i) => i.id === selected)) return g.key;
    return null;
  }, [menu, selected]);

  const [expanded, setExpanded] = useState(() => new Set(selectedGroupKey ? [selectedGroupKey] : []));
  const toggleGroup = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const renderSection = () => {
    const Comp = VIEWS[selected];
    return Comp ? <Comp /> : <div className="p-6 text-gray-500">Selecciona una opcion del menu.</div>;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-100">
      <aside className="w-72 bg-indigo-900 text-white shadow-lg flex flex-col">
        <div className="px-4 py-4 border-b border-indigo-800 flex items-center justify-center">
          <img
            src="/kazehanalogo.png"
            alt="Logo del hotel"
            className="object-contain"
            style={{ width: 120, height: 120 }}
          />
        </div>

        <nav className="flex-1 overflow-y-auto">
          <div className="p-3">
            <button
              onClick={handleGeneralInfo}
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm font-semibold shadow-sm"
            >
              Informacion general
            </button>
          </div>
          {menu.map((group) => {
            const isOpen = expanded.has(group.key);
            return (
              <div key={group.key} className="border-b border-indigo-800/60">
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-indigo-100 hover:bg-indigo-800/60"
                  aria-expanded={isOpen}
                >
                  <span>{group.title}</span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>

                <div
                  className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
                    isOpen ? "max-h-[1000px]" : "max-h-0"
                  }`}
                >
                  <ul className="px-3 py-2 space-y-1">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => {
                            setSelected(item.id);
                            if (!expanded.has(group.key)) toggleGroup(group.key);
                          }}
                          className={`flex w-full items-center justify-between text-left text-sm rounded-lg px-3 py-2 ${
                            selected === item.id ? "bg-white/15 text-white font-medium" : "hover:bg-indigo-800/50 text-indigo-100"
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

        <div className="px-4 py-6 flex items-center gap-4">
          <img src="/kazehanalogo.png" alt="Logo" className="h-28 w-28 object-contain" />
          <div className="text-base">
            <div className="font-semibold leading-tight">Kazehana PMS</div>
            <div className="text-indigo-200 text-xs mt-1">Management</div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col bg-white/60 backdrop-blur-sm">
        <header className="flex items-center justify-between px-6 py-4 border-b bg-white/80">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Management</h1>
            <p className="text-sm text-gray-500">Configuracion y seguridad del hotel</p>
          </div>
          <div className="flex items-center gap-3 relative" ref={menusRef}>
            <button
              className="relative rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              onClick={() => {
                setAlertsOpen((v) => !v);
                setUserMenuOpen(false);
              }}
              aria-label="Alertas"
            >
              <Bell className="w-4 h-4" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-3 px-1.5 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
              <span className="hidden sm:inline">Alertas</span>
            </button>
            {alertsOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white border shadow-xl rounded-xl p-3 z-20 max-h-80 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">Alertas</div>
                  <button className="text-xs text-gray-500 hover:text-gray-700 underline" onClick={() => setAlerts([])}>
                    Limpiar
                  </button>
                </div>
                {alerts.length === 0 ? (
                  <div className="text-sm text-gray-600">No hay alertas.</div>
                ) : (
                  <ul className="space-y-2">
                    {alerts.map((a) => (
                      <li key={a.id ?? a.title} className="border rounded-lg p-2 text-sm">
                        <div className="font-medium text-gray-800">{a.title || "Alerta"}</div>
                        {a.desc && <div className="text-gray-600 text-xs">{a.desc}</div>}
                        {a.at && <div className="text-gray-400 text-[11px] mt-1">{a.at}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
                onClick={() => {
                  setUserMenuOpen((v) => !v);
                  setAlertsOpen(false);
                }}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <CircleUser className="w-5 h-5 text-gray-600" />
                <div className="text-left text-sm leading-tight">
                  <div className="font-medium text-gray-800">{user?.name || user?.email || "Usuario"}</div>
                  <div className="text-xs text-gray-500">{user?.role || "Hotel"}</div>
                </div>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border shadow-xl rounded-xl overflow-hidden z-30">
                  <div className="px-3 py-2 text-sm border-b">
                    <div className="font-semibold text-gray-800">{user?.name || "Usuario"}</div>
                    <div className="text-xs text-gray-500">{user?.email || user?.role || ""}</div>
                  </div>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span>Salir</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{renderSection()}</main>
      </div>
    </div>
  );
}
