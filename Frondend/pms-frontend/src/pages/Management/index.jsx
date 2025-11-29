//src/pages/Management/index.jsx

import React from "react";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Tabs } from "./components/ui/tabs";

import Roles from "./Roles";
import AuditLog from "./AuditLog";
import RoomTypes from "./Frontdesk/RoomTypes";
import Rooms from "./Frontdesk/Rooms";
import RatePlans from "./Frontdesk/RatePlans";
import Contracts from "./Frontdesk/Contracts";
import PaymentMethods from "./Payments/PaymentMethods";
import Discounts from "./Discounts/Discounts";
import Taxes from "./Taxes/Taxes";
import Printers from "./Printers/Printers";
import Currency from "./Currency/Currency";
import HotelInfo from "./Hotel/HotelInfo";
import Cashier from "./Cashier/Cashier";
import MealPlans from "./Frontdesk/MealPlans";
import UsersFD from "./UsersFD/UsersFD";
import Invoicing from "./Invoicing/Invoicing";

export default function Management() {
  const tabs = [
    { value:"roles", label:"Perfiles & Permisos", content:<Roles/> },
    { value:"audit", label:"Bitácora", content:<AuditLog/> },

    { value:"roomtypes", label:"Tipos de Habitación", content:<RoomTypes/> },
    { value:"rooms", label:"Habitaciones", content:<Rooms/> },
    { value:"rates", label:"Tarifarios", content:<RatePlans/> },
    { value:"contracts", label:"Contratos/Canales", content:<Contracts/> },
    { value:"meal", label:"Regímenes", content:<MealPlans/> },

    { value:"payments", label:"Formas de Pago", content:<PaymentMethods/> },
    { value:"discounts", label:"Descuentos", content:<Discounts/> },
    { value:"taxes", label:"Impuestos", content:<Taxes/> },
    { value:"printers", label:"Impresoras", content:<Printers/> },
    { value:"currency", label:"Moneda", content:<Currency/> },
    { value:"hotel", label:"Hotel/Idioma/Nacionalidades", content:<HotelInfo/> },
    { value:"cashier", label:"Cierres de Caja", content:<Cashier/> },

    { value:"usersfd", label:"Usuarios Front Desk", content:<UsersFD/> },
    { value:"einvoice", label:"Sistema de Facturación", content:<Invoicing/> },
  ];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Management</h2>
        <p className="text-sm text-neutral-600">Control central de configuraciones y seguridad.</p>
      </CardHeader>
      <CardContent>
        <Tabs tabs={tabs} defaultTab="roles" />
      </CardContent>
    </Card>
  );
}
