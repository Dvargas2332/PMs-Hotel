import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RestaurantPayments() {
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
      Efectivo: "Cash",
      Tarjeta: "Card",
      SINPE: "SINPE",
      Transferencia: "Bank transfer",
      Habitacion: "Room charge",
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
          <h3 className="font-semibold text-lg">Payments and currency</h3>
          <p className="text-sm text-gray-600">Currencies, exchange rate, and accepted payment methods.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Base currency" value={paymentsCfg.monedaBase} onChange={(e) => setPaymentsCfg((f) => ({ ...f, monedaBase: e.target.value }))} />
          <Input placeholder="Secondary currency" value={paymentsCfg.monedaSec} onChange={(e) => setPaymentsCfg((f) => ({ ...f, monedaSec: e.target.value }))} />
          <Input placeholder="Exchange rate" type="number" money value={paymentsCfg.tipoCambio} onChange={(e) => setPaymentsCfg((f) => ({ ...f, tipoCambio: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Available methods</div>
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
            Enable room charges (Front Desk lookup)
          </label>
          {paymentsCfg.cargoHabitacion && (
            <Button size="sm" variant="outline" onClick={() => window.alert("Room lookup (mock)")}>
              Test room lookup
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
                  window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Payments and currency saved" } }));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving..." : "Save payments/currency"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
