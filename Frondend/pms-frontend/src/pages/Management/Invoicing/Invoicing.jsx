//src/pages/Management/Invoicing/Invoicing.jsx

import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { api } from "../../../lib/api";

export default function Invoicing() {
  const [cfg, setCfg] = useState({ einvoiceEnabled:true, profile:"GENERAL", sequencePrefix:"FD-", environment:"test" });

  const load = async () => {
    const { data } = await api.get("/api/invoicing");
    setCfg(data || cfg);
  };
  useEffect(()=>{ load(); },[]);

  const save = async () => { await api.put("/api/invoicing", cfg); };

  return (
    
      <Card className="space-y-3 p-5">
        <h3 className="font-medium">Sistema de Facturación</h3>
        <div className="flex gap-6">
          <Checkbox checked={cfg.einvoiceEnabled} onChange={v=>setCfg(s=>({...s,einvoiceEnabled:v}))} label="Factura electrónica habilitada"/>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          <Input placeholder="Perfil eInvoice" value={cfg.profile} onChange={e=>setCfg(s=>({...s,profile:e.target.value}))}/>
          <Input placeholder="Prefijo de secuencia" value={cfg.sequencePrefix} onChange={e=>setCfg(s=>({...s,sequencePrefix:e.target.value}))}/>
          <Input placeholder="Ambiente (test/prod)" value={cfg.environment} onChange={e=>setCfg(s=>({...s,environment:e.target.value}))}/>
        </div>
        <Button onClick={save}>Guardar</Button>
      
    </Card>
  );
}
