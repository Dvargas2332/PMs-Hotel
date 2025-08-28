import React, { useState } from "react";
function onChange(e) {
const { name, value } = e.target;
setLocal((s) => ({ ...s, [name]: value }));
}


function onSave() {
// normaliza HH:mm a HH:mm:ss
const norm = (t) => (t?.length === 5 ? `${t}:00` : t);
updateSettings({
checkIn: norm(local.checkIn),
checkOut: norm(local.checkOut),
timeZone: local.timeZone || "America/Costa_Rica",
});
}


return (
<section className="space-y-3">
<h2 className="text-lg font-semibold">Ajustes del hotel</h2>
<div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
<div>
<label className="block text-sm font-medium">Check-in</label>
<input type="time" name="checkIn" value={local.checkIn.slice(0,5)} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
</div>
<div>
<label className="block text-sm font-medium">Check-out</label>
<input type="time" name="checkOut" value={local.checkOut.slice(0,5)} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
</div>
<div>
<label className="block text-sm font-medium">Zona horaria</label>
<input name="timeZone" value={local.timeZone} onChange={onChange} className="w-full border rounded-lg px-3 py-2" />
</div>
<button onClick={onSave} className="h-[42px] rounded-lg border px-4 font-medium">Guardar</button>
</div>
</section>
);



function RoomsManager() {
const { rooms, addRoom, removeRoom } = useHotelData();
const [roomId, setRoomId] = useState("");
const [roomTitle, setRoomTitle] = useState("");


function add() {
if (!roomId) return;
addRoom({ id: roomId, title: roomTitle || roomId });
setRoomId("");
setRoomTitle("");
}


return (
<section className="space-y-3">
<h2 className="text-lg font-semibold">Habitaciones</h2>
<div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
<div>
<label className="block text-sm font-medium">ID</label>
<input value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
</div>
<div className="md:col-span-3">
<label className="block text-sm font-medium">Título</label>
<input value={roomTitle} onChange={(e) => setRoomTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
</div>
<button onClick={add} className="h-[42px] rounded-lg border px-4 font-medium">Agregar</button>
</div>


<div className="border rounded-xl overflow-hidden">
<table className="w-full text-sm">
<thead className="bg-gray-50">
<tr>
<th className="text-left p-2">ID</th>
<th className="text-left p-2">Título</th>
<th className="p-2 text-right">Acciones</th>
</tr>
</thead>
<tbody>
{rooms.map((r) => (
<tr key={r.id} className="border-t">
<td className="p-2">{r.id}</td>
<td className="p-2">{r.title}</td>
<td className="p-2 text-right">
<button onClick={() => removeRoom(r.id)} className="text-red-600 hover:underline">Eliminar</button>
</td>
</tr>
))}
</tbody>
</table>
</div>
</section>
);
}