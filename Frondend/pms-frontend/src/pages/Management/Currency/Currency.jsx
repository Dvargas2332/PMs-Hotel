//src/pages/Management/Currency/Currency.jsx

import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function Currency() {
  const [state, setState] = useState({ base:"CRC", secondaries:["USD"], rounding:"line", fx:{ USD:530 } });

  const load = async () => {
    const { data } = await api.get("/api/currency");
    setState(data || state);
  };
  useEffect(()=>{ load(); },[]);

  const save = async () => {
    const payload = {
      ...state,
      secondaries: typeof state.secondaries === "string"
        ? state.secondaries.split(",").map(s=>s.trim())
        : state.secondaries
    };
    await api.put("/api/currency", payload);
  };

  return (
    
      <Card className="space-y-3 p-5">
        <h3 className="font-medium">Moneda y Tipo de Cambio</h3>
        <div className="grid md:grid-cols-3 gap-2">
          <Input placeholder="Moneda base" value={state.base} onChange={e=>setState(s=>({...s, base:e.target.value}))}/>
          <Input placeholder="Secundarias (coma)" value={Array.isArray(state.secondaries)?state.secondaries.join(", "):state.secondaries}
            onChange={e=>setState(s=>({...s, secondaries:e.target.value}))}/>
          <Input placeholder="Redondeo (line/total)" value={state.rounding} onChange={e=>setState(s=>({...s, rounding:e.target.value}))}/>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          <Input placeholder="FX USD" type="number" value={state.fx?.USD ?? 0} onChange={e=>setState(s=>({...s, fx:{...s.fx, USD:Number(e.target.value||0)}}))}/>
        </div>
        <Button onClick={save}>Guardar</Button>
    </Card>
  );
}
