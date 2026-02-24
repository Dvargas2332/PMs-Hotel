//src/pages/Management/Roles.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { SimpleTable } from "../../components/ui/table";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function Roles() {
  const { hotel } = useAuth();
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

  const allowedModules = useMemo(() => {
    const list = hotel?.allowedModules;
    if (!Array.isArray(list) || list.length === 0) return null;
    return new Set(list.map((m) => String(m).toLowerCase()));
  }, [hotel?.allowedModules]);

  const isModuleEnabled = useCallback(
    (code) => {
      if (!code) return true;
      if (!allowedModules) return true;
      return allowedModules.has(String(code).toLowerCase());
    },
    [allowedModules]
  );

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

  const filteredPermissions = useMemo(() => {
    if (!allowedModules) return permissions;
    return (permissions || []).filter((perm) => {
      const [mod] = String(perm || "").split(".");
      return isModuleEnabled(mod);
    });
  }, [permissions, allowedModules, isModuleEnabled]);

  const filteredRoles = useMemo(() => {
    if (!allowedModules) return roles;
    return (roles || []).filter((role) => {
      if (role.id === "ADMIN") return true;
      const list = rolePerms[role.id];
      if (!Array.isArray(list) || list.length === 0) return true;
      if (list.includes("*")) return true;
      return list.some((perm) => {
        const [mod] = String(perm || "").split(".");
        return isModuleEnabled(mod);
      });
    });
  }, [roles, rolePerms, allowedModules, isModuleEnabled]);

  const filteredProfiles = useMemo(() => {
    if (!filteredRoles.length) return profiles;
    const allowedIds = new Set(filteredRoles.map((r) => r.id));
    return (profiles || []).filter((acc) => !acc.roleId || allowedIds.has(acc.roleId));
  }, [profiles, filteredRoles]);

  useEffect(() => {
    if (!selectedRole) return;
    const exists = filteredRoles.some((r) => r.id === selectedRole);
    if (!exists) {
      setSelectedRole("");
      setSelectedProfileOption("");
    }
  }, [filteredRoles, selectedRole]);

  const resetForm = () => {
    setFormRole({ id: "", name: "", description: "", jobTitle: "" });
    setEditingId(null);
  };

  const roleOptions = useMemo(() => {
    const presets = [
      { module: "frontdesk", id: "FRONTDESK", name: "Frontdesk" },
      { module: "restaurant", id: "RESTAURANT", name: "Restaurant" },
      { module: "accounting", id: "ACCOUNTING", name: "Accounting" },
      { module: "einvoicing", id: "EINVOICING", name: "E-Invoicing" },
      { module: "management", id: "MANAGEMENT", name: "Management" },
    ];
    const options = [{ value: "", label: "Select role ID..." }];
    presets.forEach((r) => {
      if (isModuleEnabled(r.module)) {
        options.push({ value: r.id, label: r.name });
      }
    });
    options.push({ value: "ADMIN", label: "Admin" });
    return options;
  }, [isModuleEnabled]);

  const roleNameById = useMemo(() => {
    const map = {};
    roleOptions.forEach((opt) => {
      if (!opt.value) return;
      map[opt.value] = opt.label || opt.value;
    });
    return map;
  }, [roleOptions]);

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
          <div className="grid gap-2 md:grid-cols-[200px_1fr] max-w-[420px]">
            <Select
              className="w-full"
              value={formRole.id}
              onChange={(val) =>
                setFormRole((r) => ({
                  ...r,
                  id: val,
                  name: r.name ? r.name : roleNameById[val] || r.name,
                }))
              }
              options={roleOptions}
            />
            <Input
              className="w-full"
              placeholder="Name"
              value={formRole.name}
              onChange={(e) => setFormRole((r) => ({ ...r, name: e.target.value }))}
            />
          </div>
          <Input
            className="w-full max-w-[420px]"
            placeholder="Job title"
            value={formRole.jobTitle}
            onChange={(e) => setFormRole((r) => ({ ...r, jobTitle: e.target.value }))}
          />
          <Input
            className="w-full max-w-[420px]"
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
            rows={filteredRoles.map((r) => ({
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
                ...filteredProfiles.map((acc) => ({
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
              <PermissionsByModule permissions={filteredPermissions} selectedRole={selectedRole} rolePerms={rolePerms} setRolePerms={setRolePerms} />
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
  const [openModules, setOpenModules] = useState(() => new Set());

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
    const raw = String(perm || "");
    const parts = raw.split(".");
    if (parts.length <= 1) return raw;
    const tail = parts.slice(1).join(" ").replace(/_/g, " ").trim();
    if (!tail) return raw;
    if (tail === "access") return "Access";
    return tail;
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

  const isModuleOpen = (mod) => openModules.has(mod);
  const toggleModule = (mod) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(mod) ? next.delete(mod) : next.add(mod);
      return next;
    });
  };

  const setAllInModule = (mod, checked) => {
    if (selectedRole === "ADMIN") return;
    const perms = grouped[mod] || [];
    setRolePerms((prev) => {
      const cur = new Set(prev[selectedRole] || []);
      perms.forEach((p) => {
        if (checked) cur.add(p);
        else cur.delete(p);
      });
      return { ...prev, [selectedRole]: [...cur] };
    });
  };

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([mod, perms]) => (
        <div key={mod} className="rounded-lg border p-3">
          <button
            type="button"
            className="w-full flex items-center justify-between text-sm font-semibold uppercase text-gray-700"
            onClick={() => toggleModule(mod)}
          >
            <span>{mod}</span>
            <span className="text-xs normal-case text-gray-500">{isModuleOpen(mod) ? "Hide" : "Show"}</span>
          </button>
          {isModuleOpen(mod) && (
            <div className="mt-3 space-y-3">
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={selectedRole === "ADMIN"}
                  onChange={(e) => setAllInModule(mod, e.target.checked)}
                  checked={
                    selectedRole === "ADMIN" ||
                    perms.every((p) => {
                      const list = rolePerms[selectedRole] || [];
                      return list.includes("*") || list.includes(p);
                    })
                  }
                />
                Select all
              </label>
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
          )}
        </div>
      ))}
    </div>
  );
}
