import React from "react";

const SECTIONS = [
  {
    title: "Ocupación y forecast",
    items: [
      "Ocupación diaria y futura",
      "Pick-up y pace vs histórico",
      "Llegadas / salidas / no-show / cancelaciones",
      "Overstay / understay y mix por tipo de habitación",
    ],
  },
  {
    title: "Revenue y KPIs",
    items: [
      "ADR, RevPAR, TrevPAR",
      "Ingreso por segmento / canal / tarifa / paquete",
      "Comparativos YoY / MoM y vs presupuesto/forecast",
      "Upsells y upgrades",
    ],
  },
  {
    title: "Distribución",
    items: [
      "Producción por canal (directo, OTA, empresa)",
      "Comisiones estimadas/pagadas",
      "Paridad: tarifa publicada vs vendida",
    ],
  },
  {
    title: "Housekeeping y mantenimiento",
    items: [
      "Estatus de cuartos (limpios/sucios/OOS)",
      "Productividad: limpiezas por turno/tiempo",
      "Tickets de mantenimiento y tiempos de resolución",
    ],
  },
  {
    title: "Finanzas y caja (hotel)",
    items: [
      "Cierres de caja por turno/usuario",
      "Mix de pago (efectivo/tarjeta/otros)",
      "Cobranzas (city ledger) y aging de cuentas",
      "Batch de tarjetas y chargebacks",
    ],
  },
  {
    title: "Clientes y calidad",
    items: [
      "Estancias repetidas y top clientes/empresas",
      "Motivos de cancelación",
      "Feedback/encuestas",
    ],
  },
  {
    title: "Auditoría",
    items: [
      "Bitácora de cambios sensibles (tarifas, ajustes, anulaciones)",
      "Aperturas / cierres de caja",
      "Accesos y permisos",
    ],
  },
];

export default function ReportesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-emerald-900">Reportes del Hotel</h1>
        <p className="text-sm text-slate-600">Catálogo de reportes operativos y financieros del Front Desk.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="rounded-2xl border border-emerald-100 bg-white shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-emerald-800">{sec.title}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Hotel
              </span>
            </div>
            <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
              {sec.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
              Ver reporte
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
