//src/pages/Management/Printers/Printers.jsx

import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { SimpleTable } from "../../../components/ui/table";
import { api } from "../../../lib/api";

export default function Printers() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id:"", name:"", kind:"a4", module:"frontdesk" });

  const load = async () => {
    const { data } = await api.get("/api/printers");
    setItems(data || []);
  };
  useEffect(()=>{ load(); },[]);

  const onCreate = async () => {
    const { data } = await api.post("/api/printers", form);
    setItems(prev => [...prev, data]);
    setForm({ id:"", name:"", kind:"a4", module:"frontdesk" });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      
        <Card>
          <h3 className="font-medium">Nueva Impresora</h3>
          <Input placeholder="ID" value={form.id} onChange={e=>setForm(f=>({...f,id:e.target.value}))}/>
          <Input placeholder="Nombre" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Tipo (a4/ticket80/ticket58)" value={form.kind} onChange={e=>setForm(f=>({...f,kind:e.target.value}))}/>
            <Input placeholder="Módulo (frontdesk/accounting/restaurant)" value={form.module} onChange={e=>setForm(f=>({...f,module:e.target.value}))}/>
          </div>
          <Button onClick={onCreate}>Crear</Button>
      </Card>
      <div>
        <SimpleTable
          cols={[{key:"id",label:"ID"},{key:"name",label:"Nombre"},{key:"kind",label:"Tipo"},{key:"module",label:"Módulo"}]}
          rows={items}
        />
      </div>
    </div>
  );
}
