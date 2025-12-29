//src/pages/Management/Hotel/HotelInfo.jsx

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { api } from "../../../lib/api";

export default function HotelInfo() {
  const [info, setInfo] = useState({
    name:"", legalName:"", phone:"", email:"", languages:"es,en",
    nationalities:"Costa Rica,United States", address:""
  });

  const load = async () => {
    const { data } = await api.get("/hotel");
    if (data) {
      setInfo({
        ...data,
        languages: Array.isArray(data.languages) ? data.languages.join(",") : (data.languages||""),
        nationalities: Array.isArray(data.nationalities) ? data.nationalities.join(",") : (data.nationalities||"")
      });
    }
  };
  useEffect(()=>{ load(); },[]);

  const save = useCallback(async () => {
    const payload = {
      ...info,
      languages: info.languages.split(",").map(s=>s.trim()),
      nationalities: info.nationalities.split(",").map(s=>s.trim())
    };
    await api.put("/hotel", payload);
  }, [info]);

  useEffect(() => {
    const onSave = () => { save(); };
    window.addEventListener("pms:save-hotel-info", onSave);
    return () => window.removeEventListener("pms:save-hotel-info", onSave);
  }, [save]);

  return (
    
      <Card className="space-y-3 p-5">
        <h3 className="font-medium">Hotel settings</h3>
        <div className="grid md:grid-cols-2 gap-2">
          <Input placeholder="Trade name" value={info.name} onChange={e=>setInfo(s=>({...s,name:e.target.value}))}/>
          <Input placeholder="Legal name" value={info.legalName} onChange={e=>setInfo(s=>({...s,legalName:e.target.value}))}/>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <Input placeholder="Phone" value={info.phone} onChange={e=>setInfo(s=>({...s,phone:e.target.value}))}/>
          <Input placeholder="Email" value={info.email} onChange={e=>setInfo(s=>({...s,email:e.target.value}))}/>
        </div>
        <Input placeholder="Languages (comma-separated)" value={info.languages} onChange={e=>setInfo(s=>({...s,languages:e.target.value}))}/>
        <Textarea placeholder="Nationalities (comma-separated)" value={info.nationalities} onChange={v=>setInfo(s=>({...s,nationalities:v}))}/>
        <Textarea placeholder="Address" value={info.address} onChange={v=>setInfo(s=>({...s,address:v}))}/>
        <Button onClick={save}>Save</Button>
    </Card>
  );
}
