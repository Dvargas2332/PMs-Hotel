import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Checkbox } from "../../../components/ui/checkbox";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

export default function RestaurantTaxes() {
  const { t } = useLanguage();
  const [taxDiscount, setTaxDiscount] = useState({
    iva: "13",
    servicio: "10",
    descuentoMax: "15",
    permitirDescuentos: true,
    impuestoIncluido: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/restaurant/taxes")
      .then(({ data }) => {
        if (data && typeof data === "object") {
          setTaxDiscount((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      await api.put("/restaurant/taxes", taxDiscount);
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: t("mgmt.restaurant.common.alertTitle"), desc: t("mgmt.restaurantTaxes.saved") },
        })
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">{t("mgmt.restaurantTaxes.title")}</h3>
          <p className="text-sm text-gray-600">{t("mgmt.restaurantTaxes.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input
            placeholder={t("mgmt.restaurantTaxes.iva")}
            type="number"
            value={taxDiscount.iva}
            onChange={(e) => setTaxDiscount((f) => ({ ...f, iva: e.target.value }))}
          />
          <Input
            placeholder={t("mgmt.restaurantTaxes.service")}
            type="number"
            value={taxDiscount.servicio}
            onChange={(e) => setTaxDiscount((f) => ({ ...f, servicio: e.target.value }))}
          />
          <Input
            placeholder={t("mgmt.restaurantTaxes.maxDiscount")}
            type="number"
            value={taxDiscount.descuentoMax}
            onChange={(e) => setTaxDiscount((f) => ({ ...f, descuentoMax: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={taxDiscount.permitirDescuentos}
              onCheckedChange={(v) => setTaxDiscount((f) => ({ ...f, permitirDescuentos: Boolean(v) }))}
            />
            {t("mgmt.restaurantTaxes.allowDiscounts")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={taxDiscount.impuestoIncluido}
              onCheckedChange={(v) => setTaxDiscount((f) => ({ ...f, impuestoIncluido: Boolean(v) }))}
            />
            {t("mgmt.restaurantTaxes.priceIncludes")}
          </label>
        </div>
        <div className="flex justify-end">
          <button className="px-4 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50" disabled={saving} onClick={save}>
            {saving ? t("mgmt.restaurantTaxes.saving") : t("common.save")}
          </button>
        </div>
      </Card>
    </div>
  );
}
