import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RestaurantFamilies() {
  const [familyForm, setFamilyForm] = useState({ grupo: "", familia: "", subfamilia: "" });
  const [families, setFamilies] = useState([]);

  useEffect(() => {
    api
      .get("/restaurant/families")
      .then(({ data }) => {
        if (Array.isArray(data)) setFamilies(data);
      })
      .catch(() => {});
  }, []);

  const addFamily = () => {
    if (!familyForm.grupo || !familyForm.familia) return;
    api
      .post("/restaurant/families", familyForm)
      .then(({ data }) => {
        const item = data?.id ? data : { ...familyForm, id: Date.now().toString() };
        setFamilies((prev) => [...prev, item]);
        setFamilyForm({ grupo: "", familia: "", subfamilia: "" });
      })
      .catch(() => {});
  };

  const removeFamily = (id) => {
    api.delete(`/restaurant/families/${id}`).finally(() => {
      setFamilies((prev) => prev.filter((f) => f.id !== id));
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">Grupos, familias y subfamilias</h3>
          <p className="text-sm text-gray-600">Estructura para art&iacute;culos y reportes.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Grupo" value={familyForm.grupo} onChange={(e) => setFamilyForm((f) => ({ ...f, grupo: e.target.value }))} />
          <Input placeholder="Familia" value={familyForm.familia} onChange={(e) => setFamilyForm((f) => ({ ...f, familia: e.target.value }))} />
          <Input placeholder="Subfamilia" value={familyForm.subfamilia} onChange={(e) => setFamilyForm((f) => ({ ...f, subfamilia: e.target.value }))} />
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={addFamily}>Agregar</Button>
        </div>
        {families.length > 0 && (
          <div className="grid md:grid-cols-3 gap-2">
            {families.map((f) => (
              <div key={f.id} className="border rounded-lg px-3 py-2 flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-semibold">{f.grupo}</div>
                  <div className="text-xs text-gray-600">{f.familia}{f.subfamilia ? ` / ${f.subfamilia}` : ""}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => removeFamily(f.id)}>Quitar</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
