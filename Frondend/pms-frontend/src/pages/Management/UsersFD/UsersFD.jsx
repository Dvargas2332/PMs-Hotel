// src/pages/Management/UsersFD/UsersFD.jsx
import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { SimpleTable } from "../../../components/ui/table";
import { api } from "../../../lib/api";
import { Checkbox } from "../../../components/ui/checkbox";

export default function UsersFD() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    id: "",
    name: "",
    username: "",
    roles: "FRONTDESK_AGENT",
    pinPolicy: 4,
    active: true,
  });

  const load = async () => {
    // si api ya tiene baseURL /api, usa "/usersFD"
    const { data } = await api.get("/usersFD");
    setItems(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    const payload = {
      ...form,
      pinPolicy: Number(form.pinPolicy || 4),
      roles: form.roles.split(",").map((s) => s.trim()),
    };
    const { data } = await api.post("/usersFD", payload);
    setItems((prev) => [...prev, data]);
    setForm({
      id: "",
      name: "",
      username: "",
      roles: "FRONTDESK_AGENT",
      pinPolicy: 4,
      active: true,
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="space-y-3 p-5">
        <h3 className="font-medium">Usuario Front Desk</h3>

        <Input
          placeholder="ID"
          value={form.id}
          onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
        />
        <Input
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          placeholder="Usuario"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
        />

        <div className="grid grid-cols-3 gap-2">
          <Input
            placeholder="Roles (coma)"
            value={form.roles}
            onChange={(e) => setForm((f) => ({ ...f, roles: e.target.value }))}
          />
          <Input
            placeholder="PIN (longitud)"
            type="number"
            value={form.pinPolicy}
            onChange={(e) => setForm((f) => ({ ...f, pinPolicy: e.target.value }))}
          />
          {/* Si tu Checkbox te entrega event, usa e.target.checked; si entrega booleano, usa v */}
          <Checkbox
            checked={form.active}
            onChange={(vOrEvent) =>
              setForm((f) => ({
                ...f,
                active:
                  typeof vOrEvent === "boolean" ? vOrEvent : !!vOrEvent?.target?.checked,
              }))
            }
            label="Activo"
          />
        </div>

        <Button onClick={onCreate}>Crear</Button>
      </Card>

      <div>
        <SimpleTable
          cols={[
            { key: "id", label: "ID" },
            { key: "name", label: "Nombre" },
            { key: "username", label: "Usuario" },
            { key: "roles", label: "Roles" },
            { key: "pinPolicy", label: "PIN" },
            { key: "active", label: "Activo" },
          ]}
          rows={items.map((x) => ({
            ...x,
            roles: (x.roles || []).join(", "),
            active: x.active ? "Sí" : "No",
          }))}
        />
      </div>
    </div>
  );
}
