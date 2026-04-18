import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

export default function RestaurantPayments() {
  const { t } = useLanguage();
  const [paymentsCfg, setPaymentsCfg] = useState({
    monedaBase: "CRC",
    monedaSec: "USD",
    tipoCambio: "540",
    cobros: ["Efectivo", "Tarjeta"],
    cargoHabitacion: false,
  });
  const [saving, setSaving] = useState(false);
  const methodLabel = (method) =>
    ({
      Efectivo: t("mgmt.restaurant.payments.method.cash"),
      Tarjeta: t("mgmt.restaurant.payments.method.card"),
      SINPE: "SINPE",
      Transferencia: t("mgmt.restaurant.payments.method.bankTransfer"),
      Habitacion: t("mgmt.restaurant.payments.method.roomCharge"),
    })[method] || method;

  const toggleCobro = (method) => {
    setPaymentsCfg((prev) => {
      const exists = prev.cobros.includes(method);
      const cobros = exists ? prev.cobros.filter((m) => m !== method) : [...prev.cobros, method];
      return { ...prev, cobros };
    });
  };

  useEffect(() => {
    api
      .get("/restaurant/payments")
      .then(({ data }) => {
        if (data && typeof data === "object") setPaymentsCfg((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">{t("mgmt.restaurant.payments.title")}</h3>
          <p className="text-sm text-slate-400">{t("mgmt.restaurant.payments.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder={t("mgmt.restaurant.payments.baseCurrency")} value={paymentsCfg.monedaBase} onChange={(e) => setPaymentsCfg((f) => ({ ...f, monedaBase: e.target.value }))} />
          <Input placeholder={t("mgmt.restaurant.payments.exchangeCurrency")} value={paymentsCfg.monedaSec} onChange={(e) => setPaymentsCfg((f) => ({ ...f, monedaSec: e.target.value }))} />
          <Input placeholder={t("mgmt.restaurant.payments.exchangeRate")} type="number" money value={paymentsCfg.tipoCambio} onChange={(e) => setPaymentsCfg((f) => ({ ...f, tipoCambio: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">{t("mgmt.restaurant.payments.methodsTitle")}</div>
          <div className="flex flex-wrap gap-2">
            {["Efectivo", "Tarjeta", "SINPE", "Transferencia", "Habitacion"].map((m) => {
              const active = paymentsCfg.cobros.includes(m);
              return (
                <Button key={m} size="sm" variant={active ? "default" : "outline"} onClick={() => toggleCobro(m)}>
                  {methodLabel(m)}
                </Button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={paymentsCfg.cargoHabitacion}
              onCheckedChange={(v) => setPaymentsCfg((f) => ({ ...f, cargoHabitacion: Boolean(v) }))}
            />
            {t("mgmt.restaurant.payments.roomCharge")}
          </label>
          {paymentsCfg.cargoHabitacion && (
            <Button size="sm" variant="outline" onClick={() => window.alert(t("mgmt.restaurant.payments.testRoomLookup"))}>
              {t("mgmt.restaurant.payments.testRoomLookup")}
            </Button>
          )}
          <div className="flex justify-end pt-2">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={async () => {
                try {
                  setSaving(true);
                  await api.put("/restaurant/payments", paymentsCfg);
                  window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: t("mgmt.restaurant.alert.paymentsSaved") } }));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? t("common.loading") : t("mgmt.restaurant.payments.save")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
