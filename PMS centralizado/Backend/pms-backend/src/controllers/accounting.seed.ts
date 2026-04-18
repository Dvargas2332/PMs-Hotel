// Plan de cuentas base para Costa Rica (NIIF PYMES)
// Se aplica cuando el hotel inicializa el módulo de contabilidad por primera vez.

export interface SeedAccount {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE" | "COST";
  parentCode?: string;
  isSystem: boolean;
  description?: string;
}

export const CR_CHART_OF_ACCOUNTS: SeedAccount[] = [
  // ─── 1. ACTIVO ───────────────────────────────────────────────
  { code: "1", name: "ACTIVO", type: "ASSET", isSystem: true },

  { code: "1.1", name: "Activo Corriente", type: "ASSET", parentCode: "1", isSystem: true },

  { code: "1.1.01", name: "Caja y Bancos", type: "ASSET", parentCode: "1.1", isSystem: true },
  { code: "1.1.01.001", name: "Caja General", type: "ASSET", parentCode: "1.1.01", isSystem: true },
  { code: "1.1.01.002", name: "Caja Chica", type: "ASSET", parentCode: "1.1.01", isSystem: false },
  { code: "1.1.01.010", name: "Banco Nacional CR — Cuenta Corriente", type: "ASSET", parentCode: "1.1.01", isSystem: false },
  { code: "1.1.01.011", name: "Banco Nacional CR — Cuenta Dólares", type: "ASSET", parentCode: "1.1.01", isSystem: false },
  { code: "1.1.01.020", name: "BAC Credomatic — Cuenta Corriente", type: "ASSET", parentCode: "1.1.01", isSystem: false },

  { code: "1.1.02", name: "Cuentas por Cobrar", type: "ASSET", parentCode: "1.1", isSystem: true },
  { code: "1.1.02.001", name: "Clientes — Hospedaje", type: "ASSET", parentCode: "1.1.02", isSystem: true },
  { code: "1.1.02.002", name: "Clientes — Restaurante", type: "ASSET", parentCode: "1.1.02", isSystem: true },
  { code: "1.1.02.003", name: "Clientes — Facturación Electrónica", type: "ASSET", parentCode: "1.1.02", isSystem: true },
  { code: "1.1.02.009", name: "Otras Cuentas por Cobrar", type: "ASSET", parentCode: "1.1.02", isSystem: false },

  { code: "1.1.03", name: "Inventarios", type: "ASSET", parentCode: "1.1", isSystem: false },
  { code: "1.1.03.001", name: "Inventario de Alimentos", type: "ASSET", parentCode: "1.1.03", isSystem: false },
  { code: "1.1.03.002", name: "Inventario de Bebidas", type: "ASSET", parentCode: "1.1.03", isSystem: false },
  { code: "1.1.03.003", name: "Inventario de Suministros", type: "ASSET", parentCode: "1.1.03", isSystem: false },

  { code: "1.1.04", name: "Impuestos Pagados por Adelantado", type: "ASSET", parentCode: "1.1", isSystem: false },
  { code: "1.1.04.001", name: "IVA Acreditable", type: "ASSET", parentCode: "1.1.04", isSystem: false },

  { code: "1.1.05", name: "Gastos Pagados por Adelantado", type: "ASSET", parentCode: "1.1", isSystem: false },
  { code: "1.1.05.001", name: "Seguros Prepagados", type: "ASSET", parentCode: "1.1.05", isSystem: false },
  { code: "1.1.05.002", name: "Alquileres Prepagados", type: "ASSET", parentCode: "1.1.05", isSystem: false },

  { code: "1.2", name: "Activo No Corriente", type: "ASSET", parentCode: "1", isSystem: true },

  { code: "1.2.01", name: "Propiedad, Planta y Equipo", type: "ASSET", parentCode: "1.2", isSystem: false },
  { code: "1.2.01.001", name: "Terrenos", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.002", name: "Edificios", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.003", name: "Mobiliario y Equipo", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.004", name: "Equipo de Cómputo", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.005", name: "Vehículos", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.099", name: "Depreciación Acumulada", type: "ASSET", parentCode: "1.2.01", isSystem: false },

  { code: "1.2.02", name: "Activos Intangibles", type: "ASSET", parentCode: "1.2", isSystem: false },
  { code: "1.2.02.001", name: "Licencias y Software", type: "ASSET", parentCode: "1.2.02", isSystem: false },

  // ─── 2. PASIVO ───────────────────────────────────────────────
  { code: "2", name: "PASIVO", type: "LIABILITY", isSystem: true },

  { code: "2.1", name: "Pasivo Corriente", type: "LIABILITY", parentCode: "2", isSystem: true },

  { code: "2.1.01", name: "Cuentas por Pagar", type: "LIABILITY", parentCode: "2.1", isSystem: true },
  { code: "2.1.01.001", name: "Proveedores Nacionales", type: "LIABILITY", parentCode: "2.1.01", isSystem: false },
  { code: "2.1.01.002", name: "Proveedores Extranjeros", type: "LIABILITY", parentCode: "2.1.01", isSystem: false },

  { code: "2.1.02", name: "Impuestos por Pagar", type: "LIABILITY", parentCode: "2.1", isSystem: true },
  { code: "2.1.02.001", name: "IVA por Pagar", type: "LIABILITY", parentCode: "2.1.02", isSystem: true, description: "Impuesto al Valor Agregado (13%)" },
  { code: "2.1.02.002", name: "Impuesto de Renta por Pagar", type: "LIABILITY", parentCode: "2.1.02", isSystem: false },
  { code: "2.1.02.003", name: "Cargas Sociales por Pagar (CCSS)", type: "LIABILITY", parentCode: "2.1.02", isSystem: false },
  { code: "2.1.02.004", name: "INS por Pagar", type: "LIABILITY", parentCode: "2.1.02", isSystem: false },

  { code: "2.1.03", name: "Ingresos Diferidos", type: "LIABILITY", parentCode: "2.1", isSystem: true },
  { code: "2.1.03.001", name: "Anticipos de Clientes — Hospedaje", type: "LIABILITY", parentCode: "2.1.03", isSystem: true },
  { code: "2.1.03.002", name: "Anticipos de Clientes — Restaurante", type: "LIABILITY", parentCode: "2.1.03", isSystem: false },

  { code: "2.1.04", name: "Gastos Acumulados por Pagar", type: "LIABILITY", parentCode: "2.1", isSystem: false },
  { code: "2.1.04.001", name: "Salarios por Pagar", type: "LIABILITY", parentCode: "2.1.04", isSystem: false },
  { code: "2.1.04.002", name: "Vacaciones por Pagar", type: "LIABILITY", parentCode: "2.1.04", isSystem: false },
  { code: "2.1.04.003", name: "Aguinaldo por Pagar", type: "LIABILITY", parentCode: "2.1.04", isSystem: false },

  { code: "2.2", name: "Pasivo No Corriente", type: "LIABILITY", parentCode: "2", isSystem: false },
  { code: "2.2.01", name: "Préstamos Bancarios a Largo Plazo", type: "LIABILITY", parentCode: "2.2", isSystem: false },
  { code: "2.2.01.001", name: "Préstamo Banco Nacional CR", type: "LIABILITY", parentCode: "2.2.01", isSystem: false },

  // ─── 3. PATRIMONIO ───────────────────────────────────────────
  { code: "3", name: "PATRIMONIO", type: "EQUITY", isSystem: true },

  { code: "3.1", name: "Capital Social", type: "EQUITY", parentCode: "3", isSystem: true },
  { code: "3.1.01", name: "Capital Pagado", type: "EQUITY", parentCode: "3.1", isSystem: true },

  { code: "3.2", name: "Reservas", type: "EQUITY", parentCode: "3", isSystem: false },
  { code: "3.2.01", name: "Reserva Legal", type: "EQUITY", parentCode: "3.2", isSystem: false },

  { code: "3.3", name: "Utilidades", type: "EQUITY", parentCode: "3", isSystem: true },
  { code: "3.3.01", name: "Utilidades Retenidas de Períodos Anteriores", type: "EQUITY", parentCode: "3.3", isSystem: true },
  { code: "3.3.02", name: "Utilidad / Pérdida del Período", type: "EQUITY", parentCode: "3.3", isSystem: true },

  // ─── 4. INGRESOS ─────────────────────────────────────────────
  { code: "4", name: "INGRESOS", type: "INCOME", isSystem: true },

  { code: "4.1", name: "Ingresos Operacionales", type: "INCOME", parentCode: "4", isSystem: true },

  { code: "4.1.01", name: "Ingresos por Hospedaje", type: "INCOME", parentCode: "4.1", isSystem: true },
  { code: "4.1.01.001", name: "Alquiler de Habitaciones", type: "INCOME", parentCode: "4.1.01", isSystem: true },
  { code: "4.1.01.002", name: "Servicios de Habitación", type: "INCOME", parentCode: "4.1.01", isSystem: false },

  { code: "4.1.02", name: "Ingresos por Restaurante", type: "INCOME", parentCode: "4.1", isSystem: true },
  { code: "4.1.02.001", name: "Ventas de Alimentos", type: "INCOME", parentCode: "4.1.02", isSystem: true },
  { code: "4.1.02.002", name: "Ventas de Bebidas", type: "INCOME", parentCode: "4.1.02", isSystem: true },
  { code: "4.1.02.003", name: "Servicios de Banquetes y Eventos", type: "INCOME", parentCode: "4.1.02", isSystem: false },

  { code: "4.1.03", name: "Otros Ingresos Operacionales", type: "INCOME", parentCode: "4.1", isSystem: false },
  { code: "4.1.03.001", name: "Ingresos por Lavandería", type: "INCOME", parentCode: "4.1.03", isSystem: false },
  { code: "4.1.03.002", name: "Ingresos por Estacionamiento", type: "INCOME", parentCode: "4.1.03", isSystem: false },
  { code: "4.1.03.003", name: "Ingresos por Tours y Actividades", type: "INCOME", parentCode: "4.1.03", isSystem: false },

  { code: "4.2", name: "Ingresos No Operacionales", type: "INCOME", parentCode: "4", isSystem: false },
  { code: "4.2.01", name: "Diferencial Cambiario", type: "INCOME", parentCode: "4.2", isSystem: false },
  { code: "4.2.02", name: "Ingresos por Intereses", type: "INCOME", parentCode: "4.2", isSystem: false },

  // ─── 5. COSTOS ───────────────────────────────────────────────
  { code: "5", name: "COSTOS", type: "COST", isSystem: true },

  { code: "5.1", name: "Costo de Ventas — Restaurante", type: "COST", parentCode: "5", isSystem: true },
  { code: "5.1.01", name: "Costo de Alimentos Vendidos", type: "COST", parentCode: "5.1", isSystem: true },
  { code: "5.1.02", name: "Costo de Bebidas Vendidas", type: "COST", parentCode: "5.1", isSystem: true },

  { code: "5.2", name: "Costo de Ventas — Hospedaje", type: "COST", parentCode: "5", isSystem: false },
  { code: "5.2.01", name: "Costo de Suministros de Habitación", type: "COST", parentCode: "5.2", isSystem: false },

  // ─── 6. GASTOS ───────────────────────────────────────────────
  { code: "6", name: "GASTOS", type: "EXPENSE", isSystem: true },

  { code: "6.1", name: "Gastos de Personal", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.1.01", name: "Salarios y Sueldos", type: "EXPENSE", parentCode: "6.1", isSystem: false },
  { code: "6.1.02", name: "Cargas Sociales (CCSS — Patrono)", type: "EXPENSE", parentCode: "6.1", isSystem: false },
  { code: "6.1.03", name: "Aguinaldo", type: "EXPENSE", parentCode: "6.1", isSystem: false },
  { code: "6.1.04", name: "Vacaciones", type: "EXPENSE", parentCode: "6.1", isSystem: false },
  { code: "6.1.05", name: "INS Riesgos del Trabajo", type: "EXPENSE", parentCode: "6.1", isSystem: false },

  { code: "6.2", name: "Gastos Generales y Administrativos", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.2.01", name: "Alquiler de Local", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.02", name: "Servicios Públicos — Electricidad", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.03", name: "Servicios Públicos — Agua", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.04", name: "Servicios Públicos — Internet y Teléfono", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.05", name: "Seguros", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.06", name: "Mantenimiento y Reparaciones", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.07", name: "Material de Oficina y Papelería", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.08", name: "Publicidad y Mercadeo", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.09", name: "Honorarios Profesionales", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.10", name: "Licencias y Patentes Municipales", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.11", name: "Gastos de Limpieza y Aseo", type: "EXPENSE", parentCode: "6.2", isSystem: false },

  { code: "6.3", name: "Depreciaciones y Amortizaciones", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.3.01", name: "Depreciación de Edificios", type: "EXPENSE", parentCode: "6.3", isSystem: false },
  { code: "6.3.02", name: "Depreciación de Mobiliario y Equipo", type: "EXPENSE", parentCode: "6.3", isSystem: false },
  { code: "6.3.03", name: "Depreciación de Equipo de Cómputo", type: "EXPENSE", parentCode: "6.3", isSystem: false },

  { code: "6.4", name: "Gastos Financieros", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.4.01", name: "Intereses Bancarios", type: "EXPENSE", parentCode: "6.4", isSystem: false },
  { code: "6.4.02", name: "Comisiones Bancarias", type: "EXPENSE", parentCode: "6.4", isSystem: false },
  { code: "6.4.03", name: "Diferencial Cambiario (pérdida)", type: "EXPENSE", parentCode: "6.4", isSystem: false },

  { code: "6.5", name: "Impuestos y Contribuciones", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.5.01", name: "Impuesto de Renta", type: "EXPENSE", parentCode: "6.5", isSystem: false },
  { code: "6.5.02", name: "Impuesto Municipal", type: "EXPENSE", parentCode: "6.5", isSystem: false },
];

/**
 * Aplica el plan de cuentas CR a un hotel que no tenga cuentas aún.
 * Retorna la cantidad de cuentas insertadas.
 */
export async function seedChartOfAccounts(
  prisma: any,
  hotelId: string
): Promise<number> {
  const existing = await prisma.accountingAccount.count({ where: { hotelId } });
  if (existing > 0) return 0;

  // Insertar en orden para respetar la jerarquía (padres antes que hijos)
  const idMap: Record<string, string> = {};

  for (const acc of CR_CHART_OF_ACCOUNTS) {
    const created = await prisma.accountingAccount.create({
      data: {
        hotelId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        isSystem: acc.isSystem,
        description: acc.description ?? null,
        parentId: acc.parentCode ? (idMap[acc.parentCode] ?? null) : null,
        updatedAt: new Date(),
      },
    });
    idMap[acc.code] = created.id;
  }

  return CR_CHART_OF_ACCOUNTS.length;
}
