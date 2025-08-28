// src/modulos/management/index.jsx
import { useRoutes, Navigate } from "react-router-dom";
import ManagementTabs from "./components/ManagementTabs";

// Landing Settings
import SettingsHome from "./sections/settings/SettingsHome";

// Users
import UsersLayout from "./sections/settings/users/UsersLayout";
import UsersPermissions from "./sections/settings/users/UsersPermissions";
import UsersModules from "./sections/settings/users/UsersModules";
import UsersTasks from "./sections/settings/users/UsersTasks";

// Front Desk
import FDLayout from "./sections/settings/frontdesk/FDLayout";
import FDRooms from "./sections/settings/frontdesk/FDRooms";
import FDRates from "./sections/settings/frontdesk/FDRates";
import FDPrinters from "./sections/settings/frontdesk/FDPrinters";
import FDCurrency from "./sections/settings/frontdesk/FDCurrency";

// Restaurant & Accounting
import RestaurantSettings from "./sections/settings/restaurant/RestaurantSettings";
import AccountingSettings from "./sections/settings/accounting/AccountingSettings";

export default function ManagementModule() {
  return useRoutes([
    {
      element: <ManagementTabs />,
      children: [
        // Settings como "dashboard" del módulo
        { index: true, element: <SettingsHome /> },
        // Alias: /management/settings → SettingsHome
        { path: "settings", element: <SettingsHome /> },

        // Users dentro de Settings
        {
          path: "settings/users",
          element: <UsersLayout />,
          children: [
            { index: true, element: <Navigate to="permissions" replace /> },
            { path: "permissions", element: <UsersPermissions /> },
            { path: "modules", element: <UsersModules /> },
            { path: "tasks", element: <UsersTasks /> },
          ],
        },

        // Front Desk (config)
        {
          path: "frontdesk",
          element: <FDLayout />,
          children: [
            { index: true, element: <Navigate to="rooms" replace /> },
            { path: "rooms", element: <FDRooms /> },
            { path: "rates", element: <FDRates /> },
            { path: "printers", element: <FDPrinters /> },
            { path: "currency", element: <FDCurrency /> },
          ],
        },

        // Restaurant & Accounting
        { path: "restaurant", element: <RestaurantSettings /> },
        { path: "accounting", element: <AccountingSettings /> },

        // Fallback del módulo
        { path: "*", element: <Navigate to="." replace /> },
      ],
    },
  ]);
}
