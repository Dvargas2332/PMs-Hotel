// src/App.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Provider de settings
import { SettingsProvider } from "./context/SettingsContext";

// Páginas / componentes
import Planning from "./components/Planning";
import Layout from "./components/Layout";
import Dashboard from "./pages/FrontDeskPages/Dashboard";
import ClientesPage from "./pages/FrontDeskPages/ClientesPage";
import ConfiguracionPage from "./pages/FrontDeskPages/ConfiguracionPage";
import ReservationsPage from "./pages/FrontDeskPages/ReservationsPage";
import BillingPage from "./pages/FrontDeskPages/FacturacionPage";
import HabitacionesBoard from "./pages/FrontDeskPages/HabitacionesBoard";
import ReportesPage from "./pages/FrontDeskPages/ReportesPage";

import Launcher from "./modulos/launcher";
import AccountingPage from "./modulos/accounting/AccountingPage";
import EInvoicingPage from "./modulos/einvoicing/EInvoicingPage";
import RestaurantPage from "./modulos/restaurant/RestaurantPage";
import KdsPage from "./modulos/restaurant/KdsPage";
import RestaurantLobby from "./modulos/restaurant/RestaurantLobby";
import RestaurantStaffPage from "./modulos/restaurant/RestaurantStaffPage";
import Managementpage from "./pages/Management/ManagementPage";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoutes";
import Launchergestor from "./modulos/launchergestor";
import { useLanguage } from "./context/LanguageContext";

export default function App() {
  const { t } = useLanguage();
  return (
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
        <Route
          path="/launchergestor"
          element={
            <ProtectedRoute>
              <Launchergestor />
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
          <Route path="facturacion" element={<BillingPage />} />
          <Route path="habitaciones" element={<HabitacionesBoard />} />
          <Route path="reportes" element={<ReportesPage />} />
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
          path="/e-invoicing"
          element={
            <ProtectedRoute>
              <EInvoicingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant"
          element={
            <ProtectedRoute>
              <RestaurantLobby />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/pos"
          element={
            <ProtectedRoute>
              <RestaurantPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/kds"
          element={
            <ProtectedRoute>
              <KdsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/staff"
          element={
            <ProtectedRoute>
              <RestaurantStaffPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback global */}
        <Route path="*" element={<div className="p-4">{t("common.notFound")}</div>} />
      </Routes>
    </SettingsProvider>
  );
}
