// src/App.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// ⬇️ Provider de settings
import { SettingsProvider } from "./context/SettingsContext";

// Páginas / componentes
import Planning from "./components/Planning";
import Layout from "./components/Layout";
import Dashboard from "./pages/FrontDeskPages/Dashboard";
import ClientesPage from "./pages/FrontDeskPages/ClientesPage";
import ConfiguracionPage from "./pages/FrontDeskPages/ConfiguracionPage";
import ReservationsPage from "./pages/FrontDeskPages/ReservationsPage";
import FacturacionPage from "./pages/FrontDeskPages/FacturacionPage";
import HabitacionesBoard from "./pages/FrontDeskPages/HabitacionesBoard";

import Launcher from "./modulos/launcher";
import AccountingPage from "./modulos/accounting/AccountingPage";
import RestaurantPage from "./modulos/restaurant/RestaurantPage";
import Managementpage from "./pages/Management/ManagementPage";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoutes";

export default function App() {
  return (
    // ⬇️ Envuelve todas las rutas con SettingsProvider
    <SettingsProvider>
      <Routes>
        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Inicio */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/launcher"
          element={
            <ProtectedRoute>
              <Launcher />
            </ProtectedRoute>
          }
        />

        {/* FrontDesk con Layout + Outlet */}
        <Route
          path="/frontdesk"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="planning" element={<Planning />} />
          <Route path="reservas" element={<ReservationsPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="configuracion" element={<ConfiguracionPage />} />
          <Route path="facturacion" element={<FacturacionPage />} />
          <Route path="habitaciones" element={<HabitacionesBoard />} />
          <Route
            path="reportes"
            element={<div className="p-4">Reportes — próximamente</div>}
          />
          <Route path="*" element={<Navigate to="." replace />} />
        </Route>

        {/* Management (subrutas dentro del módulo) */}
        <Route
          path="/management/*"
          element={
            <ProtectedRoute>
              <Managementpage />
            </ProtectedRoute>
          }
        />

        {/* Otros módulos sueltos */}
        <Route
          path="/accounting"
          element={
            <ProtectedRoute>
              <AccountingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant"
          element={
            <ProtectedRoute>
              <RestaurantPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback global */}
        <Route path="*" element={<div className="p-4">Página no encontrada</div>} />
      </Routes>
    </SettingsProvider>
  );
}
