//src/pages/Management/AuditLog.jsx

import React, { useEffect, useMemo, useState } from "react";
import { SimpleTable } from "../../components/ui/table";
import { api } from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    const { data } = await api.get("/api/audit");
    setRows(Array.isArray(data) ? data : []);
  };
  useEffect(()=>{ load(); },[]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const haystack = JSON.stringify(r || {}).toLowerCase();
      const matchesText = !q || haystack.includes(q.toLowerCase());
      const matchesUser = !user || String(r.userId || "").toLowerCase().includes(user.toLowerCase());

      if (!matchesText || !matchesUser) return false;

      if (from) {
        const ts = new Date(r.timestamp || r.at || 0).getTime();
        const fromTs = new Date(from).getTime();
        if (ts && ts < fromTs) return false;
      }
      if (to) {
        const ts = new Date(r.timestamp || r.at || 0).getTime();
        const toTs = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1; // end of day
        if (ts && ts > toTs) return false;
      }
      return true;
    });
  }, [rows, q, user, from, to]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <Input placeholder="Search (module/action/ID)" value={q} onChange={e=>setQ(e.target.value)} />
        <Input placeholder="User" value={user} onChange={e=>setUser(e.target.value)} />
        <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={e=>setTo(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" className="w-full" onClick={load}>Search</Button>
          <Button variant="ghost" className="w-full" onClick={()=>{ setQ(""); setUser(""); setFrom(""); setTo(""); }}>Clear</Button>
        </div>
      </div>
      <SimpleTable
        cols={[
          {key:"timestamp", label:"Date"},
          {key:"userId", label:"User"},
          {key:"module", label:"Module"},
          {key:"action", label:"Action / Task"},
          {key:"entityType", label:"Entity"},
          {key:"entityId", label:"ID"},
          {key:"reason", label:"Details"}
        ]}
        rows={(filtered || []).map((r)=>({
          ...r,
          timestamp: r.timestamp ? new Date(r.timestamp).toLocaleString() : r.at || "",
          action: r.action || r.task || r.description,
          reason: r.reason || r.detail || "",
        }))}
      />
    </div>
  );
}
