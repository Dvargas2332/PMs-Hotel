// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Componentes y páginas existentes
import Planning from "./components/Planning";
import Layout from "./components/Layout";
import Dashboard from "./pages/FrontDeskPages/Dashboard";
import ClientesPage from "./pages/FrontDeskPages/ClientesPage";
import ConfiguracionPage from "./pages/FrontDeskPages/ConfiguracionPage";
import ReservationsPage from "./pages/FrontDeskPages/ReservationsPage";
import FacturacionPage from "./pages/FrontDeskPages/FacturacionPage";
import HabitacionesBoard from "./pages/FrontDeskPages/HabitacionesBoard";

// Nuevo: launcher y módulos
import Launcher from "./modulos/launcher";
import AccountingPage from "./modulos/accounting/AccountingPage";
import RestaurantPage from "./modulos/restaurant/RestaurantPage";

// Management (index.jsx)
import ManagementModule from "./modulos/management";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Pantalla inicial */}
        <Route path="/" element={<Launcher />} />

        {/* FrontDesk con Layout y subrutas */}
        <Route path="/frontdesk" element={<Layout />}>
          {/* Index muestra Dashboard (sin redirección) */}
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="planning" element={<Planning />} />
          <Route path="reservas" element={<ReservationsPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="configuracion" element={<ConfiguracionPage />} />
          <Route path="facturacion" element={<FacturacionPage />} />
          <Route path="habitaciones" element={<HabitacionesBoard />} />
          {/* Stub para Reportes (evita 404 desde el sidebar) */}
          <Route
            path="reportes"
            element={<div className="p-4">Reportes — próximamente</div>}
          />
          {/* Fallback interno del módulo */}
          <Route path="*" element={<Navigate to="." replace />} />
        </Route>

        {/* Management con subrutas definidas en modulos/management/index.jsx */}
        <Route path="/management/*" element={<ManagementModule />} />

        {/* Otros módulos */}
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/restaurant" element={<RestaurantPage />} />

        {/* Fallback global */}
        <Route path="*" element={<div className="p-4">Página no encontrada</div>} />
      </Routes>
    </Router>
  );
}
