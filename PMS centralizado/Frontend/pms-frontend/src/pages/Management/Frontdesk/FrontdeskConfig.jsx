import React, { useState } from "react";
import { Card } from "../../../components/ui/card";
import { useLanguage } from "../../../context/LanguageContext";

import RoomTypes from "./RoomTypes";
import Rooms from "./Rooms";
import RatePlans from "./RatePlans";
import Contracts from "./Contracts";
import MealPlans from "./MealPlans";
import Payments from "../Payments/PaymentMethods";
import Discounts from "../Discounts/Discounts";
import Taxes from "../Taxes/Taxes";
import Currency from "../Currency/Currency";
import Printers from "../Printers/Printers";
import Cashier from "../Cashier/Cashier";
import Hotel from "../Hotel/HotelInfo";
import Invoicing from "../Invoicing/Invoicing";

const VIEWS = {
  rooms: Rooms,
  roomTypes: RoomTypes,
  rates: RatePlans,
  contracts: Contracts,
  mealPlans: MealPlans,
  billingSystem: Invoicing,
  paymentMethods: Payments,
  discounts: Discounts,
  taxes: Taxes,
  currency: Currency,
  printers: Printers,
  cashClosures: Cashier,
  hotelInfo: Hotel,
};

export default function FrontdeskConfig() {
  const { t } = useLanguage();
  const [active, setActive] = useState("rooms");

  const navTabs = [
    { id: "rooms",          label: t("mgmt.shell.menu.frontdesk.rooms") },
    { id: "roomTypes",      label: t("mgmt.shell.menu.frontdesk.roomTypes") },
    { id: "rates",          label: t("mgmt.shell.menu.frontdesk.rates") },
    { id: "contracts",      label: t("mgmt.shell.menu.frontdesk.contracts") },
    { id: "mealPlans",      label: t("mgmt.shell.menu.frontdesk.mealPlans") },
    { id: "billingSystem",  label: t("mgmt.shell.menu.frontdesk.billingSystem") },
    { id: "paymentMethods", label: t("mgmt.shell.menu.frontdesk.paymentMethods") },
    { id: "discounts",      label: t("mgmt.shell.menu.frontdesk.discounts") },
    { id: "taxes",          label: t("mgmt.shell.menu.frontdesk.taxes") },
    { id: "currency",       label: t("mgmt.shell.menu.frontdesk.currency") },
    { id: "printers",       label: t("mgmt.shell.menu.frontdesk.printers") },
    { id: "cashClosures",   label: t("mgmt.shell.menu.frontdesk.cashClosures") },
    { id: "hotelInfo",      label: t("mgmt.shell.menu.frontdesk.hotelInfo") },
  ];

  const Comp = VIEWS[active];

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-4">
      {/* Sidebar */}
      <Card className="p-3 space-y-1 h-max bg-indigo-900 text-indigo-50 border border-indigo-900 shadow-lg lg:sticky lg:self-start lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="text-[13px] text-center uppercase tracking-wide text-indigo-200 px-2 pb-2 font-semibold">
          {t("modules.frontdesk.name")}
        </div>
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
              active === tab.id
                ? "bg-indigo-700 text-white border border-indigo-500/60 shadow-sm"
                : "text-indigo-100 hover:bg-indigo-800/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </Card>

      {/* Content */}
      <div className="min-w-0">
        {Comp ? <Comp /> : null}
      </div>
    </div>
  );
}
