//src/pages/Management/Roles.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { SimpleTable } from "../../components/ui/table";
import { api } from "../../lib/api";

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePerms, setRolePerms] = useState({});
  const [formRole, setFormRole] = useState({ id: "", name: "", description: "", jobTitle: "" });
  const [selectedRole, setSelectedRole] = useState("");
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([api.get("/roles"), api.get("/permissions")]);
    setRoles(r.data);
    setPermissions(p.data.map((x) => x.id || x));

    const rp = {};
    for (const rr of r.data) {
      const { data } = await api.get(`/permissions/role/${rr.id}`);
      rp[rr.id] = data?.permissions || [];
    }
    setRolePerms(rp);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setFormRole({ id: "", name: "", description: "", jobTitle: "" });
    setEditingId(null);
  };

  const saveRole = async () => {
    if (!formRole.id || !formRole.name) return;
    if (editingId) {
      const { data } = await api.put(`/roles/${editingId}`, formRole);
      setRoles((prev) => prev.map((r) => (r.id === editingId ? data : r)));
    } else {
      const { data } = await api.post("/roles", formRole);
      setRoles((prev) => [...prev, data]);
    }
    resetForm();
  };

  const deleteRole = async (id) => {
    setRoles((prev) => prev.filter((r) => r.id !== id));
    await api.delete(`/roles/${id}`);
    if (selectedRole === id) setSelectedRole("");
  };

  const startEdit = (role) => {
    setFormRole({
      id: role.id || "",
      name: role.name || "",
      description: role.description || "",
      jobTitle: role.jobTitle || "",
    });
    setEditingId(role.id);
  };

  const savePerms = async () => {
    if (!selectedRole) return;
    const perms = rolePerms[selectedRole] || [];
    await api.put(`/permissions/role/${selectedRole}`, { permissions: perms });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">Usuarios / Perfiles</h3>
          <div className="flex gap-2">
            <Input
              placeholder="ID (ej. FRONTDESK_AGENT)"
              value={formRole.id}
              onChange={(e) => setFormRole((r) => ({ ...r, id: e.target.value }))}
            />
            <Input
              placeholder="Nombre"
              value={formRole.name}
              onChange={(e) => setFormRole((r) => ({ ...r, name: e.target.value }))}
            />
          </div>
          <Input
            placeholder="Puesto"
            value={formRole.jobTitle}
            onChange={(e) => setFormRole((r) => ({ ...r, jobTitle: e.target.value }))}
          />
          <Input
            placeholder="Descripción"
            value={formRole.description}
            onChange={(e) => setFormRole((r) => ({ ...r, description: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button onClick={saveRole}>{editingId ? "Guardar cambios" : "Crear perfil"}</Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
          <SimpleTable
            cols={[
              { key: "id", label: "ID" },
              { key: "name", label: "Nombre" },
              { key: "jobTitle", label: "Puesto" },
              { key: "description", label: "Descripción" },
              { key: "actions", label: "Acciones" },
            ]}
            rows={roles.map((r) => ({
              ...r,
              actions: (
                <div className="flex gap-2">
                  <Button size="xs" variant="outline" onClick={() => startEdit(r)}>
                    Editar
                  </Button>
                  <Button size="xs" variant="destructive" onClick={() => deleteRole(r.id)}>
                    Eliminar
                  </Button>
                </div>
              ),
            }))}
          />
        </Card>
      </Card>

      <Card>
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">Permisos por perfil</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm">Perfil:</span>
            <Select
              value={selectedRole}
              onChange={(val) => setSelectedRole(val)}
              options={[{ value: "", label: "Selecciona..." }, ...roles.map((r) => ({ value: r.id, label: r.name }))]}
            />
          </div>
          {selectedRole && (
            <div className="space-y-2">
              <PermissionsByModule permissions={permissions} selectedRole={selectedRole} rolePerms={rolePerms} setRolePerms={setRolePerms} />
              <Button onClick={savePerms}>Guardar permisos</Button>
            </div>
          )}
        </Card>
      </Card>
    </div>
  );
}

function PermissionsByModule({ permissions, selectedRole, rolePerms, setRolePerms }) {
  const grouped = useMemo(() => {
    const groups = {};
    (permissions || []).forEach((p) => {
      const [mod] = p.split(".");
      const key = mod || "otros";
      groups[key] = groups[key] || [];
      groups[key].push(p);
    });
    return groups;
  }, [permissions]);

  const toggle = (perm, checked) => {
    setRolePerms((prev) => {
      const cur = new Set(prev[selectedRole] || []);
      if (checked) cur.add(perm);
      else cur.delete(perm);
      return { ...prev, [selectedRole]: [...cur] };
    });
  };

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([mod, perms]) => (
        <div key={mod} className="rounded-lg border p-3">
          <div className="text-sm font-semibold mb-2 uppercase text-gray-700">{mod}</div>
          <div className="grid md:grid-cols-2 gap-2">
            {perms.map((p) => {
              const list = rolePerms[selectedRole] || [];
              const checked = list.includes("*") || list.includes(p);
              return (
                <label key={p} className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={checked} onChange={(e) => toggle(p, e.target.checked)} />
                  {p}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
