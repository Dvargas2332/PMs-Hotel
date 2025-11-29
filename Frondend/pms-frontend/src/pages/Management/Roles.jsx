//src/pages/Management/Roles.jsx

import React, { useEffect, useState } from "react";
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
  const [newRole, setNewRole] = useState({ id:"", name:"", description:"" });
  const [selectedRole, setSelectedRole] = useState("");

  const load = async () => {
    const [r,p] = await Promise.all([api.get("/api/roles"), api.get("/api/permissions")]);
    setRoles(r.data); setPermissions(p.data);
    // mock: rolePermissions en GET /api/role-permissions
    const rp = { data: {} };
    for (const rr of r.data) {
      // simplificado: pedir individual sería /api/role-permissions/{role}
      rp.data[rr.id] = (await api.get("/api/permissions")).data.includes("*") ? permissions : []; // mock seguro
    }
    // si mock no trae, intenta leer del propio mock DB rolePermissions:
    try {
      const mgr = (await api.get("/api/role-permissions/MANAGER")).data;
      rp.data["MANAGER"] = mgr?.permissions || ["frontdesk.*","accounting.*","management.*"];
    } catch {}
    setRolePerms(rp.data);
  };

  useEffect(()=>{ load(); },[]);

  const addRole = async () => {
    if (!newRole.id || !newRole.name) return;
    const { data } = await api.post("/api/roles", newRole);
    setRoles(prev => [...prev, data]);
    setNewRole({ id:"", name:"", description:"" });
  };

  const savePerms = async () => {
    if (!selectedRole) return;
    const perms = rolePerms[selectedRole] || [];
    await api.put(`/api/role-permissions/${selectedRole}`, { permissions: perms });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">Perfiles</h3>
          <div className="flex gap-2">
            <Input placeholder="ID (ej. FRONTDESK_AGENT)" value={newRole.id}
              onChange={e=>setNewRole(r=>({...r, id:e.target.value}))}/>
            <Input placeholder="Nombre" value={newRole.name}
              onChange={e=>setNewRole(r=>({...r, name:e.target.value}))}/>
          </div>
          <Input placeholder="Descripción" value={newRole.description}
            onChange={e=>setNewRole(r=>({...r, description:e.target.value}))}/>
          <Button onClick={addRole}>Crear perfil</Button>
          <SimpleTable
            cols={[{key:"id",label:"ID"},{key:"name",label:"Nombre"},{key:"description",label:"Descripción"}]}
            rows={roles}
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
              onChange={val=>setSelectedRole(val)}
              options={[{value:"",label:"Selecciona..."}, ...roles.map(r=>({value:r.id,label:r.name}))]}
            />
          </div>
          {selectedRole && (
            <div className="space-y-2">
              <div className="grid md:grid-cols-2 gap-2">
                {permissions.map(p => {
                  const list = rolePerms[selectedRole] || [];
                  const checked = list.includes("*") || list.includes(p);
                  return (
                    <label key={p} className="text-sm flex items-center gap-2">
                      <input type="checkbox" checked={checked}
                        onChange={e=>{
                          setRolePerms(prev=>{
                            const cur = new Set(prev[selectedRole]||[]);
                            if (e.target.checked) cur.add(p); else cur.delete(p);
                            return { ...prev, [selectedRole]: [...cur] };
                          })
                        }}/>
                      {p}
                    </label>
                  );
                })}
              </div>
              <Button onClick={savePerms}>Guardar permisos</Button>
            </div>
          )}
        </Card>
      </Card>
    </div>
  );
}
