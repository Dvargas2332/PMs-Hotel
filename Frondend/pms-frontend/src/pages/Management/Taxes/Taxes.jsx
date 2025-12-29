//src/pages/Management/Taxes/Taxes.jsx

import React, { useEffect, useState } from "react";
import { Card} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { SimpleTable } from "../../../components/ui/table";
import { api } from "../../../lib/api";

export default function Taxes() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ code:"", name:"", percent:13, scope:"room" });

  const load = async () => {
    const { data } = await api.get("/taxes");
    setItems(data || []);
  };
  useEffect(()=>{ load(); },[]);

  const onCreate = async () => {
    const payload = { ...form, percent: Number(form.percent||0) };
    const { data } = await api.post("/taxes", payload);
    setItems(prev => [...prev, data]);
    setForm({ code:"", name:"", percent:13, scope:"room" });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      
        <Card className="space-y-3 p-5">
          <h3 className="font-medium">Nuevo impuesto</h3>
          <Input placeholder="Código (ej: IVA)" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))}/>
          <Input placeholder="Nombre" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="% (13)" type="number" min="0" value={form.percent} onChange={e=>setForm(f=>({...f,percent:e.target.value}))}/>
            <Input placeholder="Ámbito (room/pos/fee)" value={form.scope} onChange={e=>setForm(f=>({...f,scope:e.target.value}))}/>
          </div>
          <Button onClick={onCreate}>Crear</Button>
        </Card>
      
      <div>
          <SimpleTable
          cols={[{key:"code",label:"Código"},{key:"name",label:"Nombre"},{key:"percent",label:"%"},
                {key:"scope",label:"Ámbito"}]}
          rows={items.map(x=>({...x, percent: Number(x.percent||0).toFixed(2)}))}
          />
        </div>
      </div>
  );
}
