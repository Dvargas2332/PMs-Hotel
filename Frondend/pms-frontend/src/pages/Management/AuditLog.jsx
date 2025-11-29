//src/pages/Management/AuditLog.jsx

import React, { useEffect, useState } from "react";
import { SimpleTable } from "../../components/ui/table";
import { api } from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await api.get("/api/audit");
    setRows(data || []);
  };
  useEffect(()=>{ load(); },[]);

  const filtered = rows.filter(r =>
    !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Buscar en bitácora..." value={q} onChange={e=>setQ(e.target.value)} />
        <Button variant="outline" onClick={load}>Recargar</Button>
      </div>
      <SimpleTable
        cols={[
          {key:"timestamp", label:"Fecha"},
          {key:"userId", label:"Usuario"},
          {key:"module", label:"Módulo"},
          {key:"action", label:"Acción"},
          {key:"entityType", label:"Entidad"},
          {key:"entityId", label:"ID"},
          {key:"reason", label:"Motivo"}
        ]}
        rows={filtered}
      />
    </div>
  );
}
