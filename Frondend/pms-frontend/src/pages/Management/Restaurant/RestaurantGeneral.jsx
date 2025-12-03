import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RestaurantGeneral() {
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
          <h3 className="font-semibold text-lg">Informacion general</h3>
          <p className="text-sm text-gray-600">Datos de ley y contacto del restaurante.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Input placeholder="Nombre comercial" value={info.nombreComercial} onChange={(e) => setInfo((f) => ({ ...f, nombreComercial: e.target.value }))} />
          <Input placeholder="Razon social" value={info.razonSocial} onChange={(e) => setInfo((f) => ({ ...f, razonSocial: e.target.value }))} />
          <Input placeholder="Cedula juridica" value={info.cedula} onChange={(e) => setInfo((f) => ({ ...f, cedula: e.target.value }))} />
          <Input placeholder="Resolucion Hacienda" value={info.resolucion} onChange={(e) => setInfo((f) => ({ ...f, resolucion: e.target.value }))} />
          <Input placeholder="Telefono" value={info.telefono} onChange={(e) => setInfo((f) => ({ ...f, telefono: e.target.value }))} />
          <Input placeholder="Email" value={info.email} onChange={(e) => setInfo((f) => ({ ...f, email: e.target.value }))} />
          <Input placeholder="Horario" value={info.horario} onChange={(e) => setInfo((f) => ({ ...f, horario: e.target.value }))} />
          <Input placeholder="Direccion" value={info.direccion} onChange={(e) => setInfo((f) => ({ ...f, direccion: e.target.value }))} />
        </div>
        <Textarea placeholder="Notas adicionales" value={info.notas} onChange={(e) => setInfo((f) => ({ ...f, notas: e.target.value }))} />
        <div className="flex justify-end">
          <Button
            variant="secondary"
            disabled={saving}
            onClick={async () => {
              try {
                setSaving(true);
                await api.put("/restaurant/general", info);
                window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurante", desc: "Informacion guardada" } }));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Guardando..." : "Guardar informacion"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
