//src/pages/Management/Frontdesk/RatePlans.jsx  

import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { SimpleTable } from "../../../components/ui/table";
import { api } from "../../../lib/api";

export default function RatePlans() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id:"", name:"", currency:"CRC", derived:false, price:0, restrictions:{ LOSMin:1, LOSMax:30 } });

  const load = async () => {
    const { data } = await api.get("/api/ratePlans");
    setItems(data || []);
  };
  useEffect(()=>{ load(); },[]);

  const onCreate = async () => {
    const payload = {
      ...form,
      price: Number(form.price||0),
      restrictions: {
        LOSMin: Number(form.restrictions.LOSMin||1),
        LOSMax: Number(form.restrictions.LOSMax||30),
      }
    };
    const { data } = await api.post("/api/ratePlans", payload);
    setItems(prev => [...prev, data]);
    setForm({ id:"", name:"", currency:"CRC", derived:false, price:0, restrictions:{ LOSMin:1, LOSMax:30 } });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">Nuevo Tarifario</h3>
          <Input placeholder="ID" value={form.id} onChange={e=>setForm(f=>({...f,id:e.target.value}))}/>
          <Input placeholder="Nombre" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Moneda" value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}/>
            <Input placeholder="Precio base" type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/>
            <Checkbox checked={form.derived} onChange={v=>setForm(f=>({...f,derived:v}))} label="Derivado" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="LOS Min" type="number" value={form.restrictions.LOSMin}
              onChange={e=>setForm(f=>({...f,restrictions:{...f.restrictions, LOSMin:e.target.value}}))}/>
            <Input placeholder="LOS Max" type="number" value={form.restrictions.LOSMax}
              onChange={e=>setForm(f=>({...f,restrictions:{...f.restrictions, LOSMax:e.target.value}}))}/>
          </div>
          <Button onClick={onCreate}>Crear</Button>
      </Card>
      <div>
        <SimpleTable
          cols={[{key:"id",label:"ID"},{key:"name",label:"Nombre"},{key:"currency",label:"Moneda"},{key:"price",label:"Precio"},{key:"derived",label:"Derivado"}]}
          rows={items.map(x=>({...x, derived: x.derived?"Sí":"No"}))}
        />
      </div>
    </div>
  );
}
