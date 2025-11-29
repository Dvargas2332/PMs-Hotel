//src/pages/Management/Cashier/Cashier.jsx

import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { api } from "../../../lib/api";

export default function Cashier() {
  const [cfg, setCfg] = useState({ requireOpenShift:true, reopenNeedsManager:true, cashDiffTolerance:500 });

  const load = async () => {
    const { data } = await api.get("/cashier");
    setCfg(data || cfg);
  };
  useEffect(()=>{ load(); },[]);

  const save = async () => {
    await api.post("/cashier", cfg);
  };

  return (
    
      <Card className="space-y-3 p-5">
        <h3 className="font-medium">Cierres de Caja</h3>
        <div className="flex gap-6">
          <Checkbox checked={cfg.requireOpenShift} onChange={v=>setCfg(s=>({...s,requireOpenShift:v}))} label="Requiere turno abierto para operar"/>
          <Checkbox checked={cfg.reopenNeedsManager} onChange={v=>setCfg(s=>({...s,reopenNeedsManager:v}))} label="Reapertura requiere gerente"/>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          <Input placeholder="Tolerancia de diferencia (₡)" type="number" value={cfg.cashDiffTolerance}
            onChange={e=>setCfg(s=>({...s,cashDiffTolerance:Number(e.target.value||0)}))}/>
        </div>
        <Button onClick={save}>Guardar</Button>
      
    </Card>
  );
}
