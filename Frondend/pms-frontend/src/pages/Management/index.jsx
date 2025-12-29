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
    { value:"roles", label:"Roles & permissions", content:<Roles/> },
    { value:"audit", label:"Audit log", content:<AuditLog/> },

    { value:"roomtypes", label:"Room types", content:<RoomTypes/> },
    { value:"rooms", label:"Rooms", content:<Rooms/> },
    { value:"rates", label:"Rate plans", content:<RatePlans/> },
    { value:"contracts", label:"Contracts / Channels", content:<Contracts/> },
    { value:"meal", label:"Meal plans", content:<MealPlans/> },

    { value:"payments", label:"Payment methods", content:<PaymentMethods/> },
    { value:"discounts", label:"Discounts", content:<Discounts/> },
    { value:"taxes", label:"Taxes", content:<Taxes/> },
    { value:"printers", label:"Printers", content:<Printers/> },
    { value:"currency", label:"Currency", content:<Currency/> },
    { value:"hotel", label:"Hotel / Language / Nationalities", content:<HotelInfo/> },
    { value:"cashier", label:"Cash closures", content:<Cashier/> },

    { value:"usersfd", label:"Front Desk users", content:<UsersFD/> },
    { value:"einvoice", label:"Invoicing system", content:<Invoicing/> },
  ];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Management</h2>
        <p className="text-sm text-neutral-600">Central configuration and security control.</p>
      </CardHeader>
      <CardContent>
        <Tabs tabs={tabs} defaultTab="roles" />
      </CardContent>
    </Card>
  );
}
