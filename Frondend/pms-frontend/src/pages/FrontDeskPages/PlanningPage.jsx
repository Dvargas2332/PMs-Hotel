
// Ej. src/pages/Frontdesk/Planning/Planning.jsx (snippet)
import React, { useEffect, useState } from "react";
import { api } from "../../../lib/api";import React from "react";
import Planning from "../../components/Planning";

export default function PlanningPage() {
  return (
    <div className="h-screen bg-gray-900">
      <Planning />
    </div>
  );
}


export default function Planning() {
  const [roomTypes, setRoomTypes] = useState([]);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: rt }, { data: rs }] = await Promise.all([
        api.get("/roomTypes"),
        api.get("/rooms"),
      ]);
      setRoomTypes(rt || []);
      setRooms(rs || []);
    })();
  }, []);

  // pinta columnas por tipo, filas por habitación, etc.
  return (
    <div>
      {/* usa roomTypes y rooms para tu grid de planning */}
    </div>
  );
}
