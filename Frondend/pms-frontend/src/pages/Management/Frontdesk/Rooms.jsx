//src/pages/Management/Frontdesk/Rooms.jsx

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { SimpleTable } from "../../../components/ui/table";
import { api } from "../../../lib/api";

export default function Rooms() {
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ id:"", number:"", typeId:"", floor:1, capacity:2, status:"AVAILABLE" });

  const load = async () => {
    const [{ data: rooms }, { data: roomTypes }] = await Promise.all([
      api.get("/api/rooms"), api.get("/api/roomTypes")
    ]);
    setItems(rooms || []); setTypes(roomTypes || []);
  };
  useEffect(()=>{ load(); },[]);

  const onCreate = async () => {
    const payload = { ...form, floor:Number(form.floor||1), capacity:Number(form.capacity||1) };
    const { data } = await api.post("/api/rooms", payload);
    setItems(prev => [...prev, data]);
    setForm({ id:"", number:"", typeId:"", floor:1, capacity:2, status:"AVAILABLE" });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="font-medium">Nueva Habitación</h3>
          <Input placeholder="ID interno (opcional)" value={form.id} onChange={e=>setForm(f=>({...f,id:e.target.value}))}/>
          <Input placeholder="Número" value={form.number} onChange={e=>setForm(f=>({...f,number:e.target.value}))}/>
          <Input placeholder="Tipo (ID, ej. STD)" value={form.typeId} onChange={e=>setForm(f=>({...f,typeId:e.target.value}))}/>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Piso" type="number" value={form.floor} onChange={e=>setForm(f=>({...f,floor:e.target.value}))}/>
            <Input placeholder="Capacidad" type="number" value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:e.target.value}))}/>
            <Input placeholder="Estado" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}/>
          </div>
          <Button onClick={onCreate}>Crear</Button>
        </CardContent>
      </Card>
      <div>
        <SimpleTable
          cols={[{key:"number",label:"Número"},{key:"typeId",label:"Tipo"},{key:"floor",label:"Piso"},{key:"capacity",label:"Cap"},{key:"status",label:"Estado"}]}
          rows={items}
        />
      </div>
    </div>
  );
}
