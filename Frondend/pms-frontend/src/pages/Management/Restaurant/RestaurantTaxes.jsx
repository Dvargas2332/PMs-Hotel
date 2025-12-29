import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Checkbox } from "../../../components/ui/checkbox";
import { api } from "../../../lib/api";

export default function RestaurantTaxes() {
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
        if (data && typeof data === "object") setTaxDiscount((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">Taxes and discounts</h3>
          <p className="text-sm text-gray-600">Tax, service charge, and discount control.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="IVA (%)" type="number" value={taxDiscount.iva} onChange={(e) => setTaxDiscount((f) => ({ ...f, iva: e.target.value }))} />
          <Input placeholder="Service (%)" type="number" value={taxDiscount.servicio} onChange={(e) => setTaxDiscount((f) => ({ ...f, servicio: e.target.value }))} />
          <Input placeholder="Max discount (%)" type="number" value={taxDiscount.descuentoMax} onChange={(e) => setTaxDiscount((f) => ({ ...f, descuentoMax: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={taxDiscount.permitirDescuentos}
              onCheckedChange={(v) => setTaxDiscount((f) => ({ ...f, permitirDescuentos: Boolean(v) }))}
            />
            Allow discounts in POS
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={taxDiscount.impuestoIncluido}
              onCheckedChange={(v) => setTaxDiscount((f) => ({ ...f, impuestoIncluido: Boolean(v) }))}
            />
            Prices include taxes
          </label>
        </div>
        <div className="flex justify-end">
          <button
            className="px-4 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
            disabled={saving}
            onClick={async () => {
              try {
                setSaving(true);
                await api.put("/restaurant/taxes", taxDiscount);
                window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Taxes saved" } }));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </Card>
    </div>
  );
}
