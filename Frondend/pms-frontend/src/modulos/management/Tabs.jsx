import React from "react";

export default function Tabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "rooms", label: "Habitaciones" },
    { id: "clients", label: "Clientes" },
    { id: "users", label: "Usuarios & Permisos" },
    { id: "accounting", label: "Contabilidad" },
    { id: "restaurant", label: "Restaurante" },
    { id: "frontdesk", label: "FrontDesk" },
    { id: "system", label: "Sistema" },
  ];

  return (
    <div className="flex gap-2 border-b mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-4 py-2 rounded-t-lg ${
            activeTab === tab.id
              ? "bg-blue-600 text-white"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
