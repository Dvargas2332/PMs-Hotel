// Copyright (c) 2025 Diego Vargas. Todos los derechos reservados.
// Uso, copia, modificación o distribución prohibidos sin autorización por escrito.


import React from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from "react-router-dom";

import Planning from "./components/Planning";
import ReservationsPage from "./pages/FrontDeskPages/ReservationsPage";
import ManagementPage from "./pages/Management/ManagementPage";

function Layout() {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-green-950 text-white flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-green-900">Hotel Name</div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem to="/planning">Planner</NavItem>
          <NavItem to="/reservas">Reservaciones</NavItem>
          <NavItem to="/management">Management</NavItem>
        </nav>
      </aside>
      <main className="flex-1 p-4 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block p-2 rounded transition ${isActive ? "bg-white/15 font-semibold" : "hover:bg-white/10"}`
      }
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/planning" replace />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/reservas" element={<ReservationsPage />} />
          <Route path="/management" element={<ManagementPage />} />
          <Route path="*" element={<Navigate to="/planning" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
