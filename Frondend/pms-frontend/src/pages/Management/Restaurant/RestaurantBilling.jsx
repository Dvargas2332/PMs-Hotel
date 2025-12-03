import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RestaurantBilling() {
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
        if (data && typeof data === "object") setBillingCfg((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">Facturacion</h3>
          <p className="text-sm text-gray-600">Margenes, tipo de comprobante y politicas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["factura", "tiquete", "nota"].map((tipo) => (
            <Button
              key={tipo}
              size="sm"
              variant={billingCfg.comprobante === tipo ? "default" : "outline"}
              onClick={() => setBillingCfg((f) => ({ ...f, comprobante: tipo }))}
            >
              {tipo}
            </Button>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Input placeholder="Margen (%)" type="number" value={billingCfg.margen} onChange={(e) => setBillingCfg((f) => ({ ...f, margen: e.target.value }))} />
          <Input placeholder="Propina sugerida (%)" type="number" value={billingCfg.propina} onChange={(e) => setBillingCfg((f) => ({ ...f, propina: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="auto-factura"
            checked={billingCfg.autoFactura}
            onCheckedChange={(v) => setBillingCfg((f) => ({ ...f, autoFactura: Boolean(v) }))}
          />
          <label htmlFor="auto-factura" className="text-sm">Autogenerar factura/tiquete al cerrar</label>
        </div>
        <div className="flex justify-end">
          <Button
            variant="secondary"
            disabled={saving}
            onClick={async () => {
              try {
                setSaving(true);
                await api.put("/restaurant/billing", billingCfg);
                window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurante", desc: "Facturacion guardada" } }));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Guardando..." : "Guardar facturacion"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
