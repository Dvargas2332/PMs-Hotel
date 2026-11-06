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
      <div className="flex flex-col gap-1 p-1.5 rounded-xl h-max lg:sticky lg:self-start lg:top-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="text-[11px] text-center uppercase tracking-wider px-2 py-1 font-semibold" style={{ color: "var(--color-text-muted)" }}>
          {t("modules.frontdesk.name")}
        </div>
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={
              active === tab.id
                ? { background: "#4f46e5", color: "#ffffff", boxShadow: "0 1px 6px rgba(79,70,229,0.35)" }
                : { background: "transparent", color: "var(--color-text-muted)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-w-0">
        {Comp ? <Comp /> : null}
      </div>
    </div>
  );
}
