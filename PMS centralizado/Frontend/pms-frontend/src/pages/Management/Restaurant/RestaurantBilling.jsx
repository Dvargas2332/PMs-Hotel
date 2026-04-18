import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

const RECEIPT_TYPES = ["factura", "tiquete", "nota"];

export default function RestaurantBilling() {
  const { t } = useLanguage();
  const [billingCfg, setBillingCfg] = useState({
    comprobante: "factura",
    margen: "0",
    propina: "10",
    autoFactura: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/restaurant/billing")
      .then(({ data }) => {
        if (data && typeof data === "object") {
          setBillingCfg((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
  }, []);

  const pushSavedAlert = () => {
    window.dispatchEvent(
      new CustomEvent("pms:push-alert", {
        detail: {
          title: t("mgmt.restaurant.common.alertTitle"),
          desc: t("mgmt.restaurantBilling.saved"),
        },
      })
    );
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">{t("mgmt.restaurantBilling.title")}</h3>
          <p className="text-sm text-slate-400">{t("mgmt.restaurantBilling.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RECEIPT_TYPES.map((type) => (
            <Button
              key={type}
              size="sm"
              variant={billingCfg.comprobante === type ? "default" : "outline"}
              onClick={() => setBillingCfg((f) => ({ ...f, comprobante: type }))}
            >
              {t(`mgmt.restaurantBilling.receipt.${type}`)}
            </Button>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Input
            placeholder={t("mgmt.restaurantBilling.margin")}
            type="number"
            value={billingCfg.margen}
            onChange={(e) => setBillingCfg((f) => ({ ...f, margen: e.target.value }))}
          />
          <Input
            placeholder={t("mgmt.restaurantBilling.suggestedTip")}
            type="number"
            value={billingCfg.propina}
            onChange={(e) => setBillingCfg((f) => ({ ...f, propina: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="auto-factura"
            checked={billingCfg.autoFactura}
            onCheckedChange={(v) => setBillingCfg((f) => ({ ...f, autoFactura: Boolean(v) }))}
          />
          <label htmlFor="auto-factura" className="text-sm">
            {t("mgmt.restaurantBilling.autoInvoice")}
          </label>
        </div>
        <div className="flex justify-end">
          <Button
            variant="secondary"
            disabled={saving}
            onClick={async () => {
              try {
                setSaving(true);
                await api.put("/restaurant/billing", billingCfg);
                pushSavedAlert();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? t("mgmt.restaurantBilling.saving") : t("mgmt.restaurantBilling.save")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
