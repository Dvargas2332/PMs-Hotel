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
  const [profiles, setProfiles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePerms, setRolePerms] = useState({});
  const [formRole, setFormRole] = useState({ id: "", name: "", description: "", jobTitle: "" });
  // selectedRole = roleId whose permissions we are editing
  const [selectedRole, setSelectedRole] = useState("");
  // keep track of the selected profile option so dropdown can distinguish users with same role
  const [selectedProfileOption, setSelectedProfileOption] = useState("");
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    const [r, p, acc] = await Promise.all([
      api.get("/roles"),
      api.get("/permissions"),
      api.get("/launcher").catch(() => ({ data: [] })),
    ]);
    const rolesData = Array.isArray(r.data) ? r.data : [];
    setRoles(rolesData);
    const basePerms = (Array.isArray(p.data) ? p.data : []).map((x) => x.id || x);
    const extraPerms = [
      "frontdesk.read",
      "restaurant.pos.open",
      "accounting.read",
      "einvoicing.access",
      "management.settings.write",
    ];
    const merged = Array.from(new Set([...extraPerms, ...basePerms]));
    setPermissions(merged);
    setProfiles(Array.isArray(acc.data) ? acc.data : []);

    const rp = {};
    for (const rr of rolesData) {
      const { data } = await api.get(`/permissions/role/${rr.id}`);
      rp[rr.id] = data?.permissions || [];
    }
    if (rolesData.some((r) => r.id === "ADMIN")) rp.ADMIN = ["*"];
    setRolePerms(rp);
  }, []);

  useEffect(() => {
    load();

    const onAccountsChanged = () => {
      load();
    };
    window.addEventListener("pms:launcher-accounts-changed", onAccountsChanged);

    return () => {
      window.removeEventListener("pms:launcher-accounts-changed", onAccountsChanged);
    };
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
    if (id === "ADMIN") return;
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
    const perms = selectedRole === "ADMIN" ? ["*"] : (rolePerms[selectedRole] || []);
    await api.put(`/permissions/role/${selectedRole}`, { permissions: perms });
    // Al guardar permisos, volver a dejar el selector de perfil vacío
    setSelectedRole("");
    setSelectedProfileOption("");
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">Roles</h3>
          <div className="flex gap-2">
            <Input
              placeholder="ID (e.g. FRONTDESK_AGENT)"
              value={formRole.id}
              onChange={(e) => setFormRole((r) => ({ ...r, id: e.target.value }))}
            />
            <Input
              placeholder="Name"
              value={formRole.name}
              onChange={(e) => setFormRole((r) => ({ ...r, name: e.target.value }))}
            />
          </div>
          <Input
            placeholder="Job title"
            value={formRole.jobTitle}
            onChange={(e) => setFormRole((r) => ({ ...r, jobTitle: e.target.value }))}
          />
          <Input
            placeholder="Description"
            value={formRole.description}
            onChange={(e) => setFormRole((r) => ({ ...r, description: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button onClick={saveRole}>{editingId ? "Save changes" : "Create role"}</Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
          <SimpleTable
            cols={[
              { key: "id", label: "ID" },
              { key: "name", label: "Name" },
              { key: "description", label: "Description" },
              { key: "actions", label: "Actions" },
            ]}
            rows={roles.map((r) => ({
              ...r,
              actions: (
                <div className="flex gap-2">
                  <Button size="xs" variant="outline" onClick={() => startEdit(r)}>
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="destructive"
                    onClick={() => deleteRole(r.id)}
                    disabled={r.id === "ADMIN"}
                    title={r.id === "ADMIN" ? "ADMIN role cannot be deleted." : "Delete"}
                  >
                    Delete
                  </Button>
                </div>
              ),
            }))}
          />
        </Card>
      </Card>

      <Card>
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">Permissions by role</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm">Role:</span>
            <Select
              value={selectedProfileOption}
              onChange={(val) => {
                setSelectedProfileOption(val);
                const roleId = String(val || "").split(":::")[1] || "";
                setSelectedRole(roleId);
              }}
              options={[
                { value: "", label: "Select..." },
                // Solo perfiles de launcher (UserLauncher)
                ...profiles.map((acc) => ({
                  value: `${acc.id || acc.username || acc.roleId}:::${acc.roleId}`,
                  label: acc.name || acc.username || acc.roleId,
                })),
              ]}
            />
          </div>
          {selectedRole && (
            <div className="space-y-2">
              {selectedRole === "ADMIN" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  ADMIN has full permissions and cannot be restricted.
                </div>
              )}
              <PermissionsByModule permissions={permissions} selectedRole={selectedRole} rolePerms={rolePerms} setRolePerms={setRolePerms} />
              <Button onClick={savePerms} disabled={selectedRole === "ADMIN"}>
                Save permissions
              </Button>
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
      const key = mod || "other";
      groups[key] = groups[key] || [];
      groups[key].push(p);
    });
    // Keep "access" permissions first inside each group, then alphabetically.
    Object.keys(groups).forEach((k) => {
      groups[k] = groups[k].slice().sort((a, b) => {
        const aIsAccess = a.endsWith(".access");
        const bIsAccess = b.endsWith(".access");
        if (aIsAccess !== bIsAccess) return aIsAccess ? -1 : 1;
        return a.localeCompare(b);
      });
    });
    return groups;
  }, [permissions]);

  const prettyLabel = (perm) => {
    if (perm.endsWith(".access")) return "Access module";
    return perm;
  };

  const toggle = (perm, checked) => {
    if (selectedRole === "ADMIN") return;
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
              const checked = selectedRole === "ADMIN" || list.includes("*") || list.includes(p);
              return (
                <label key={p} className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={selectedRole === "ADMIN"}
                    onChange={(e) => toggle(p, e.target.checked)}
                  />
                  {prettyLabel(p)}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
