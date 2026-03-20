//src/pages/Management/index.jsx

import React from "react";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Tabs } from "../../components/ui/tabs";
import { useLanguage } from "../../context/LanguageContext";

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
  const { t } = useLanguage();
  const tabs = [
    { value: "roles", label: t("mgmt.legacy.tabs.roles"), content: <Roles /> },
    { value: "audit", label: t("mgmt.legacy.tabs.audit"), content: <AuditLog /> },

    { value: "roomtypes", label: t("mgmt.legacy.tabs.roomTypes"), content: <RoomTypes /> },
    { value: "rooms", label: t("mgmt.legacy.tabs.rooms"), content: <Rooms /> },
    { value: "rates", label: t("mgmt.legacy.tabs.rates"), content: <RatePlans /> },
    { value: "contracts", label: t("mgmt.legacy.tabs.contracts"), content: <Contracts /> },
    { value: "meal", label: t("mgmt.legacy.tabs.mealPlans"), content: <MealPlans /> },

    { value: "payments", label: t("mgmt.legacy.tabs.paymentMethods"), content: <PaymentMethods /> },
    { value: "discounts", label: t("mgmt.legacy.tabs.discounts"), content: <Discounts /> },
    { value: "taxes", label: t("mgmt.legacy.tabs.taxes"), content: <Taxes /> },
    { value: "printers", label: t("mgmt.legacy.tabs.printers"), content: <Printers /> },
    { value: "currency", label: t("mgmt.legacy.tabs.currency"), content: <Currency /> },
    { value: "hotel", label: t("mgmt.legacy.tabs.hotelInfo"), content: <HotelInfo /> },
    { value: "cashier", label: t("mgmt.legacy.tabs.cashier"), content: <Cashier /> },

    { value: "usersfd", label: t("mgmt.legacy.tabs.frontDeskUsers"), content: <UsersFD /> },
    { value: "einvoice", label: t("mgmt.legacy.tabs.invoicing"), content: <Invoicing /> },
  ];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{t("mgmt.legacy.title")}</h2>
        <p className="text-sm text-neutral-600">{t("mgmt.legacy.subtitle")}</p>
      </CardHeader>
      <CardContent>
        <Tabs tabs={tabs} defaultTab="roles" />
      </CardContent>
    </Card>
  );
}
