//src/pages/Management/Payments/PaymentMethods.jsx

import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { SimpleTable } from "../../../components/ui/table";
import { api } from "../../../lib/api";
import { Checkbox } from "../../../components/ui/checkbox";

export default function PaymentMethods() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id:"", name:"", active:true });

  const load = async () => {
    const { data } = await api.get("/api/paymentMethods");
    setItems(data || []);
  };
  useEffect(()=>{ load(); },[]);

  const onCreate = async () => {
    const { data } = await api.post("/api/paymentMethods", form);
    setItems(prev => [...prev, data]);
    setForm({ id:"", name:"", active:true });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
    
      <Card className="space-y-3 p-5">
          <h3 className="font-medium">New payment method</h3>
          <Input placeholder="ID" value={form.id} onChange={e=>setForm(f=>({...f,id:e.target.value}))}/>
          <Input placeholder="Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
          <Checkbox checked={form.active} onChange={v=>setForm(f=>({...f,active:v}))} label="Active" />
          <Button onClick={onCreate}>Create</Button>
           
        
      </Card>
      <div>
        <SimpleTable
          cols={[{key:"id",label:"ID"},{key:"name",label:"Name"},{key:"active",label:"Active"}]}
          rows={items.map(x=>({...x, active: x.active?"Yes":"No"}))}
        />
      </div>
    </div>
  );
}
