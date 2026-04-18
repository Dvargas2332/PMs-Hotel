import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

export default function RestaurantGeneral() {
  const { t } = useLanguage();
  const [info, setInfo] = useState({
    nombreComercial: "",
    razonSocial: "",
    cedula: "",
    telefono: "",
    email: "",
    direccion: "",
    horario: "",
    resolucion: "",
    notas: "",
    inventoryEnabled: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/restaurant/general")
      .then(({ data }) => {
        if (data && typeof data === "object") setInfo((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">{t("mgmt.restaurant.general.title")}</h3>
          <p className="text-sm text-slate-400">{t("mgmt.restaurant.general.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Input placeholder={t("mgmt.restaurant.general.tradeName")} value={info.nombreComercial} onChange={(e) => setInfo((f) => ({ ...f, nombreComercial: e.target.value }))} />
          <Input placeholder={t("mgmt.restaurant.general.legalName")} value={info.razonSocial} onChange={(e) => setInfo((f) => ({ ...f, razonSocial: e.target.value }))} />
          <Input placeholder={t("mgmt.restaurant.general.legalId")} value={info.cedula} onChange={(e) => setInfo((f) => ({ ...f, cedula: e.target.value }))} />
          <Input placeholder={t("mgmt.restaurant.general.resolution")} value={info.resolucion} onChange={(e) => setInfo((f) => ({ ...f, resolucion: e.target.value }))} />
          <Input placeholder={t("mgmt.restaurant.general.phone")} value={info.telefono} onChange={(e) => setInfo((f) => ({ ...f, telefono: e.target.value }))} />
          <Input placeholder={t("mgmt.restaurant.general.email")} value={info.email} onChange={(e) => setInfo((f) => ({ ...f, email: e.target.value }))} />
          <Input placeholder={t("mgmt.restaurant.general.hours")} value={info.horario} onChange={(e) => setInfo((f) => ({ ...f, horario: e.target.value }))} />
          <Input placeholder={t("mgmt.restaurant.general.address")} value={info.direccion} onChange={(e) => setInfo((f) => ({ ...f, direccion: e.target.value }))} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={info.inventoryEnabled !== false}
            onChange={(e) => setInfo((f) => ({ ...f, inventoryEnabled: e.target.checked }))}
          />
          {t("mgmt.restaurant.inventory.settings.enable")}
        </label>
        <Textarea placeholder={t("mgmt.restaurant.general.notes")} value={info.notas} onChange={(e) => setInfo((f) => ({ ...f, notas: e.target.value }))} />
        <div className="flex justify-end">
          <Button
            variant="secondary"
            disabled={saving}
            onClick={async () => {
              try {
                setSaving(true);
                await api.put("/restaurant/general", info);
                window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: t("mgmt.restaurant.alert.generalInfoSaved") } }));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? t("common.loading") : t("mgmt.restaurant.common.save")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
