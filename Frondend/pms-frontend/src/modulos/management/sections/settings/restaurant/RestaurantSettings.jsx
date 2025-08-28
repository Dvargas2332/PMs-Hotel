// src/modulos/management/sections/Restaurant.jsx
import useConfigStore from "../../../../../store/configStore";


export default function Restaurant() {
const restaurant = useConfigStore(s => s.config.restaurant);
const setRestaurant = useConfigStore(s => s.setRestaurant);


const addTax = () => setRestaurant({ taxes: [...(restaurant.taxes||[]), { id: crypto.randomUUID(), name: "IVA", rate: 0.13 }] });


return (
<div className="space-y-3">
<button className="px-3 py-2 rounded bg-green-700 text-white" onClick={addTax}>Agregar impuesto demo</button>
<ul className="divide-y">
{(restaurant.taxes||[]).map(t => (
<li key={t.id} className="py-2 text-sm">{t.name}: {Math.round(t.rate*100)}%</li>
))}
{!(restaurant.taxes||[]).length && <li className="py-4 text-center text-sm text-gray-500">Sin impuestos configurados.</li>}
</ul>
</div>
);
}