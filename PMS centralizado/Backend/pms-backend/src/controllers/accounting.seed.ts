// Plan de cuentas base para Costa Rica (NIIF PYMES) de un PMS hotelero con restaurante.
// Se aplica cuando el hotel inicializa el módulo de contabilidad.
//
// Convención de códigos: 4 niveles separados por punto y el último nivel de 2
// dígitos (ej. 1.1.01.01). Las integraciones automáticas (restaurante,
// facturación electrónica, recepción y anticipos) esperan EXACTAMENTE los
// códigos de REQUIRED_SYSTEM_CODES, así que no deben renombrarse.

import { randomUUID } from "node:crypto";

export interface SeedAccount {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE" | "COST";
  parentCode?: string;
  isSystem: boolean;
  description?: string;
}

/**
 * Cuentas que el código usa por nombre exacto. Si cambia un código aquí, hay que
 * cambiar también `accounting.integration.ts` y `advanceDeposit.controller.ts`.
 */
export const REQUIRED_SYSTEM_CODES = {
  cash: "1.1.01.01", // Caja General (efectivo)
  receivable: "1.1.02.01", // Clientes Hospedaje
  customerAdvances: "2.1.03.01", // Anticipos de Clientes — Hospedaje
  taxPayable: "2.1.04.01", // IVA por Pagar
  restaurantIncome: "4.1.01.01", // Ventas de Alimentos (restaurante)
  lodgingIncome: "4.1.02.01", // Alquiler de Habitaciones
} as const;

export const CR_CHART_OF_ACCOUNTS: SeedAccount[] = [
  // ─── 1. ACTIVO ──────────────────────────────────────────────────────────────
  { code: "1", name: "ACTIVO", type: "ASSET", isSystem: true },

  { code: "1.1", name: "Activo Corriente", type: "ASSET", parentCode: "1", isSystem: true },

  { code: "1.1.01", name: "Efectivo y Equivalentes", type: "ASSET", parentCode: "1.1", isSystem: true },
  { code: "1.1.01.01", name: "Caja General", type: "ASSET", parentCode: "1.1.01", isSystem: true, description: "Efectivo en moneda base. Cuenta por defecto para cobros en efectivo." },
  { code: "1.1.01.02", name: "Caja Chica", type: "ASSET", parentCode: "1.1.01", isSystem: false },
  { code: "1.1.01.03", name: "Caja en Dólares", type: "ASSET", parentCode: "1.1.01", isSystem: false, description: "Efectivo en moneda extranjera." },
  { code: "1.1.01.04", name: "Banco — Cuenta Corriente Moneda Local", type: "ASSET", parentCode: "1.1.01", isSystem: false },
  { code: "1.1.01.05", name: "Banco — Cuenta Corriente Dólares", type: "ASSET", parentCode: "1.1.01", isSystem: false },
  { code: "1.1.01.06", name: "Tarjetas y SINPE por Cobrar", type: "ASSET", parentCode: "1.1.01", isSystem: false, description: "Cobros electrónicos pendientes de liquidación por el banco/adquiriente." },

  { code: "1.1.02", name: "Cuentas por Cobrar Clientes", type: "ASSET", parentCode: "1.1", isSystem: true },
  { code: "1.1.02.01", name: "Clientes — Hospedaje", type: "ASSET", parentCode: "1.1.02", isSystem: true, description: "Saldos de huéspedes y agencias por hospedaje." },
  { code: "1.1.02.02", name: "Clientes — Restaurante", type: "ASSET", parentCode: "1.1.02", isSystem: true, description: "Cuentas de casa y crédito de clientes del restaurante." },
  { code: "1.1.02.03", name: "Clientes — Facturación Electrónica", type: "ASSET", parentCode: "1.1.02", isSystem: true },
  { code: "1.1.02.04", name: "Otras Cuentas por Cobrar", type: "ASSET", parentCode: "1.1.02", isSystem: false },
  { code: "1.1.02.05", name: "Estimación para Cuentas Incobrables", type: "ASSET", parentCode: "1.1.02", isSystem: false, description: "Cuenta de naturaleza acreedora (contra-activo)." },

  { code: "1.1.03", name: "Inventarios", type: "ASSET", parentCode: "1.1", isSystem: false },
  { code: "1.1.03.01", name: "Inventario de Alimentos y Bebidas", type: "ASSET", parentCode: "1.1.03", isSystem: false },
  { code: "1.1.03.02", name: "Inventario de Suministros y Papelería", type: "ASSET", parentCode: "1.1.03", isSystem: false },
  { code: "1.1.03.03", name: "Cristalería, Vajilla y Utensilios", type: "ASSET", parentCode: "1.1.03", isSystem: false },
  { code: "1.1.03.04", name: "Ropa de Cama y Blancos", type: "ASSET", parentCode: "1.1.03", isSystem: false },

  { code: "1.1.04", name: "Gastos Pagados por Anticipado", type: "ASSET", parentCode: "1.1", isSystem: false },
  { code: "1.1.04.01", name: "Seguros Prepagados", type: "ASSET", parentCode: "1.1.04", isSystem: false },
  { code: "1.1.04.02", name: "Alquileres Prepagados", type: "ASSET", parentCode: "1.1.04", isSystem: false },
  { code: "1.1.04.03", name: "Publicidad Prepagada", type: "ASSET", parentCode: "1.1.04", isSystem: false },

  { code: "1.1.05", name: "Impuestos a Favor", type: "ASSET", parentCode: "1.1", isSystem: false },
  { code: "1.1.05.01", name: "IVA Acreditable", type: "ASSET", parentCode: "1.1.05", isSystem: false },
  { code: "1.1.05.02", name: "Retenciones a Favor", type: "ASSET", parentCode: "1.1.05", isSystem: false },

  { code: "1.2", name: "Activo No Corriente", type: "ASSET", parentCode: "1", isSystem: true },

  { code: "1.2.01", name: "Propiedad, Planta y Equipo", type: "ASSET", parentCode: "1.2", isSystem: false },
  { code: "1.2.01.01", name: "Terrenos", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.02", name: "Edificio e Instalaciones", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.03", name: "Mobiliario y Equipo de Habitaciones", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.04", name: "Mobiliario y Equipo de Restaurante", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.05", name: "Equipo de Cómputo y Sistemas", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.06", name: "Equipo de Cocina", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.07", name: "Vehículos", type: "ASSET", parentCode: "1.2.01", isSystem: false },
  { code: "1.2.01.08", name: "Herramientas y Equipo Menor", type: "ASSET", parentCode: "1.2.01", isSystem: false },

  { code: "1.2.02", name: "Depreciación Acumulada", type: "ASSET", parentCode: "1.2", isSystem: false, description: "Contra-activo: acumula la depreciación de la propiedad, planta y equipo." },
  { code: "1.2.02.01", name: "Depreciación Acumulada — Edificio", type: "ASSET", parentCode: "1.2.02", isSystem: false },
  { code: "1.2.02.02", name: "Depreciación Acumulada — Mobiliario y Equipo", type: "ASSET", parentCode: "1.2.02", isSystem: false },
  { code: "1.2.02.03", name: "Depreciación Acumulada — Equipo de Cómputo", type: "ASSET", parentCode: "1.2.02", isSystem: false },
  { code: "1.2.02.04", name: "Depreciación Acumulada — Equipo de Cocina", type: "ASSET", parentCode: "1.2.02", isSystem: false },
  { code: "1.2.02.05", name: "Depreciación Acumulada — Vehículos", type: "ASSET", parentCode: "1.2.02", isSystem: false },

  { code: "1.2.03", name: "Activos Intangibles", type: "ASSET", parentCode: "1.2", isSystem: false },
  { code: "1.2.03.01", name: "Licencias y Software", type: "ASSET", parentCode: "1.2.03", isSystem: false },
  { code: "1.2.03.02", name: "Marcas y Plusvalía", type: "ASSET", parentCode: "1.2.03", isSystem: false },

  // ─── 2. PASIVO ──────────────────────────────────────────────────────────────
  { code: "2", name: "PASIVO", type: "LIABILITY", isSystem: true },

  { code: "2.1", name: "Pasivo Corriente", type: "LIABILITY", parentCode: "2", isSystem: true },

  { code: "2.1.01", name: "Cuentas por Pagar", type: "LIABILITY", parentCode: "2.1", isSystem: true },
  { code: "2.1.01.01", name: "Proveedores Nacionales", type: "LIABILITY", parentCode: "2.1.01", isSystem: false },
  { code: "2.1.01.02", name: "Proveedores Extranjeros", type: "LIABILITY", parentCode: "2.1.01", isSystem: false },
  { code: "2.1.01.03", name: "Gastos por Pagar", type: "LIABILITY", parentCode: "2.1.01", isSystem: false },
  { code: "2.1.01.04", name: "Tarjetas de Crédito por Pagar", type: "LIABILITY", parentCode: "2.1.01", isSystem: false },

  { code: "2.1.02", name: "Obligaciones Laborales", type: "LIABILITY", parentCode: "2.1", isSystem: false },
  { code: "2.1.02.01", name: "Salarios por Pagar", type: "LIABILITY", parentCode: "2.1.02", isSystem: false },
  { code: "2.1.02.02", name: "Cargas Sociales (CCSS) por Pagar", type: "LIABILITY", parentCode: "2.1.02", isSystem: false },
  { code: "2.1.02.03", name: "INS Riesgos del Trabajo por Pagar", type: "LIABILITY", parentCode: "2.1.02", isSystem: false },
  { code: "2.1.02.04", name: "Aguinaldo por Pagar", type: "LIABILITY", parentCode: "2.1.02", isSystem: false },
  { code: "2.1.02.05", name: "Vacaciones por Pagar", type: "LIABILITY", parentCode: "2.1.02", isSystem: false },
  { code: "2.1.02.06", name: "Retenciones de Renta Empleados por Pagar", type: "LIABILITY", parentCode: "2.1.02", isSystem: false },

  { code: "2.1.03", name: "Anticipos de Clientes", type: "LIABILITY", parentCode: "2.1", isSystem: true },
  { code: "2.1.03.01", name: "Anticipos de Clientes — Hospedaje", type: "LIABILITY", parentCode: "2.1.03", isSystem: true, description: "Depósitos y prepagos de reservas aún no devengados." },
  { code: "2.1.03.02", name: "Anticipos de Clientes — Restaurante", type: "LIABILITY", parentCode: "2.1.03", isSystem: false },
  { code: "2.1.03.03", name: "Anticipos de Clientes — Eventos y Banquetes", type: "LIABILITY", parentCode: "2.1.03", isSystem: false },

  { code: "2.1.04", name: "Impuestos por Pagar", type: "LIABILITY", parentCode: "2.1", isSystem: true },
  { code: "2.1.04.01", name: "IVA por Pagar", type: "LIABILITY", parentCode: "2.1.04", isSystem: true, description: "Impuesto al Valor Agregado (13%) trasladado en las ventas." },
  { code: "2.1.04.02", name: "Impuesto de Renta por Pagar", type: "LIABILITY", parentCode: "2.1.04", isSystem: false },
  { code: "2.1.04.03", name: "Impuesto Municipal y Patente por Pagar", type: "LIABILITY", parentCode: "2.1.04", isSystem: false },
  { code: "2.1.04.04", name: "Otras Retenciones por Pagar", type: "LIABILITY", parentCode: "2.1.04", isSystem: false },

  { code: "2.1.05", name: "Ingresos Diferidos", type: "LIABILITY", parentCode: "2.1", isSystem: false },
  { code: "2.1.05.01", name: "Reservas de Habitación no Devengadas", type: "LIABILITY", parentCode: "2.1.05", isSystem: false },
  { code: "2.1.05.02", name: "Eventos Futuros por Devengar", type: "LIABILITY", parentCode: "2.1.05", isSystem: false },

  { code: "2.2", name: "Pasivo No Corriente", type: "LIABILITY", parentCode: "2", isSystem: false },

  { code: "2.2.01", name: "Préstamos y Financiamientos", type: "LIABILITY", parentCode: "2.2", isSystem: false },
  { code: "2.2.01.01", name: "Préstamos Bancarios a Largo Plazo", type: "LIABILITY", parentCode: "2.2.01", isSystem: false },
  { code: "2.2.01.02", name: "Arrendamientos Financieros", type: "LIABILITY", parentCode: "2.2.01", isSystem: false },

  { code: "2.2.02", name: "Provisiones a Largo Plazo", type: "LIABILITY", parentCode: "2.2", isSystem: false },
  { code: "2.2.02.01", name: "Provisión de Prestaciones Sociales", type: "LIABILITY", parentCode: "2.2.02", isSystem: false },

  // ─── 3. PATRIMONIO ──────────────────────────────────────────────────────────
  { code: "3", name: "PATRIMONIO", type: "EQUITY", isSystem: true },

  { code: "3.1", name: "Capital", type: "EQUITY", parentCode: "3", isSystem: true },
  { code: "3.1.01", name: "Capital Social", type: "EQUITY", parentCode: "3.1", isSystem: true },
  { code: "3.1.02", name: "Aportes de Socios", type: "EQUITY", parentCode: "3.1", isSystem: false },

  { code: "3.2", name: "Reservas", type: "EQUITY", parentCode: "3", isSystem: false },
  { code: "3.2.01", name: "Reserva Legal", type: "EQUITY", parentCode: "3.2", isSystem: false },

  { code: "3.3", name: "Resultados", type: "EQUITY", parentCode: "3", isSystem: true },
  { code: "3.3.01", name: "Utilidades Retenidas de Períodos Anteriores", type: "EQUITY", parentCode: "3.3", isSystem: true },
  { code: "3.3.02", name: "Pérdidas Acumuladas", type: "EQUITY", parentCode: "3.3", isSystem: false },
  { code: "3.3.03", name: "Resultado del Ejercicio", type: "EQUITY", parentCode: "3.3", isSystem: true },
  { code: "3.3.04", name: "Dividendos Distribuidos", type: "EQUITY", parentCode: "3.3", isSystem: false },

  // ─── 4. INGRESOS ────────────────────────────────────────────────────────────
  { code: "4", name: "INGRESOS", type: "INCOME", isSystem: true },

  { code: "4.1", name: "Ingresos Operacionales", type: "INCOME", parentCode: "4", isSystem: true },

  { code: "4.1.01", name: "Ingresos por Restaurante", type: "INCOME", parentCode: "4.1", isSystem: true },
  { code: "4.1.01.01", name: "Ventas de Alimentos", type: "INCOME", parentCode: "4.1.01", isSystem: true, description: "Ventas del POS de restaurante: platos y alimentos." },
  { code: "4.1.01.02", name: "Ventas de Bebidas", type: "INCOME", parentCode: "4.1.01", isSystem: false },
  { code: "4.1.01.03", name: "Servicio 10%", type: "INCOME", parentCode: "4.1.01", isSystem: false, description: "Propina de servicio incluida en la venta." },
  { code: "4.1.01.04", name: "Banquetes y Eventos", type: "INCOME", parentCode: "4.1.01", isSystem: false },

  { code: "4.1.02", name: "Ingresos por Hospedaje", type: "INCOME", parentCode: "4.1", isSystem: true },
  { code: "4.1.02.01", name: "Alquiler de Habitaciones", type: "INCOME", parentCode: "4.1.02", isSystem: true, description: "Ingreso por noches de habitación (recepción)." },
  { code: "4.1.02.02", name: "Servicios de Habitación", type: "INCOME", parentCode: "4.1.02", isSystem: false },
  { code: "4.1.02.03", name: "Desayunos y Planes Alimenticios", type: "INCOME", parentCode: "4.1.02", isSystem: false },

  { code: "4.1.03", name: "Otros Ingresos Operacionales", type: "INCOME", parentCode: "4.1", isSystem: false },
  { code: "4.1.03.01", name: "Lavandería", type: "INCOME", parentCode: "4.1.03", isSystem: false },
  { code: "4.1.03.02", name: "Estacionamiento", type: "INCOME", parentCode: "4.1.03", isSystem: false },
  { code: "4.1.03.03", name: "Tours y Actividades", type: "INCOME", parentCode: "4.1.03", isSystem: false },
  { code: "4.1.03.04", name: "Spa y Bienestar", type: "INCOME", parentCode: "4.1.03", isSystem: false },
  { code: "4.1.03.05", name: "Tienda y Minibar", type: "INCOME", parentCode: "4.1.03", isSystem: false },

  { code: "4.2", name: "Ingresos No Operacionales", type: "INCOME", parentCode: "4", isSystem: false },
  { code: "4.2.01", name: "Diferencial Cambiario — Ganancia", type: "INCOME", parentCode: "4.2", isSystem: false },
  { code: "4.2.02", name: "Intereses Ganados", type: "INCOME", parentCode: "4.2", isSystem: false },
  { code: "4.2.03", name: "Otros Ingresos No Operacionales", type: "INCOME", parentCode: "4.2", isSystem: false },

  // ─── 5. COSTOS ──────────────────────────────────────────────────────────────
  { code: "5", name: "COSTOS", type: "COST", isSystem: true },

  { code: "5.1", name: "Costo de Ventas — Restaurante", type: "COST", parentCode: "5", isSystem: true },
  { code: "5.1.01", name: "Costo de Alimentos", type: "COST", parentCode: "5.1", isSystem: true },
  { code: "5.1.02", name: "Costo de Bebidas", type: "COST", parentCode: "5.1", isSystem: false },
  { code: "5.1.03", name: "Merma y Desperdicio de Inventario", type: "COST", parentCode: "5.1", isSystem: false, description: "Producto quemado, vencido o perdido (quemas)." },

  { code: "5.2", name: "Costo de Ventas — Hospedaje", type: "COST", parentCode: "5", isSystem: false },
  { code: "5.2.01", name: "Suministros de Habitación", type: "COST", parentCode: "5.2", isSystem: false },
  { code: "5.2.02", name: "Lavandería y Ropa de Cama", type: "COST", parentCode: "5.2", isSystem: false },

  // ─── 6. GASTOS ──────────────────────────────────────────────────────────────
  { code: "6", name: "GASTOS", type: "EXPENSE", isSystem: true },

  { code: "6.1", name: "Gastos de Personal", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.1.01", name: "Salarios y Sueldos", type: "EXPENSE", parentCode: "6.1", isSystem: false },
  { code: "6.1.02", name: "Aguinaldo", type: "EXPENSE", parentCode: "6.1", isSystem: false },
  { code: "6.1.03", name: "Vacaciones", type: "EXPENSE", parentCode: "6.1", isSystem: false },
  { code: "6.1.04", name: "Cargas Sociales (CCSS — Patrono)", type: "EXPENSE", parentCode: "6.1", isSystem: false },
  { code: "6.1.05", name: "INS Riesgos del Trabajo", type: "EXPENSE", parentCode: "6.1", isSystem: false },
  { code: "6.1.06", name: "Horas Extra", type: "EXPENSE", parentCode: "6.1", isSystem: false },
  { code: "6.1.07", name: "Comisiones al Personal", type: "EXPENSE", parentCode: "6.1", isSystem: false },

  { code: "6.2", name: "Gastos Generales y Administrativos", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.2.01", name: "Alquiler de Local", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.02", name: "Electricidad", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.03", name: "Agua", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.04", name: "Internet y Telefonía", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.05", name: "Combustible y Transporte", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.06", name: "Mantenimiento y Reparaciones", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.07", name: "Limpieza y Aseo", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.08", name: "Papelería y Suministros de Oficina", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.09", name: "Seguros", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.10", name: "Publicidad y Mercadeo", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.11", name: "Honorarios Profesionales", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.12", name: "Patentes Municipales", type: "EXPENSE", parentCode: "6.2", isSystem: false },
  { code: "6.2.13", name: "Servicios Externos (Outsourcing)", type: "EXPENSE", parentCode: "6.2", isSystem: false },

  { code: "6.3", name: "Gastos de Operación Hotelera", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.3.01", name: "Lavandería y Ropa de Cama", type: "EXPENSE", parentCode: "6.3", isSystem: false },
  { code: "6.3.02", name: "Amenidades de Habitación", type: "EXPENSE", parentCode: "6.3", isSystem: false },
  { code: "6.3.03", name: "Comisiones de Agencias y OTAs", type: "EXPENSE", parentCode: "6.3", isSystem: false },
  { code: "6.3.04", name: "Comisiones de Tarjetas y SINPE", type: "EXPENSE", parentCode: "6.3", isSystem: false },

  { code: "6.4", name: "Depreciaciones y Amortizaciones", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.4.01", name: "Depreciación de Edificio", type: "EXPENSE", parentCode: "6.4", isSystem: false },
  { code: "6.4.02", name: "Depreciación de Mobiliario y Equipo", type: "EXPENSE", parentCode: "6.4", isSystem: false },
  { code: "6.4.03", name: "Depreciación de Equipo de Cómputo", type: "EXPENSE", parentCode: "6.4", isSystem: false },
  { code: "6.4.04", name: "Depreciación de Equipo de Cocina", type: "EXPENSE", parentCode: "6.4", isSystem: false },
  { code: "6.4.05", name: "Depreciación de Vehículos", type: "EXPENSE", parentCode: "6.4", isSystem: false },
  { code: "6.4.06", name: "Amortización de Activos Intangibles", type: "EXPENSE", parentCode: "6.4", isSystem: false },

  { code: "6.5", name: "Gastos Financieros", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.5.01", name: "Intereses Bancarios", type: "EXPENSE", parentCode: "6.5", isSystem: false },
  { code: "6.5.02", name: "Comisiones Bancarias", type: "EXPENSE", parentCode: "6.5", isSystem: false },
  { code: "6.5.03", name: "Diferencial Cambiario — Pérdida", type: "EXPENSE", parentCode: "6.5", isSystem: false },

  { code: "6.6", name: "Impuestos y Contribuciones", type: "EXPENSE", parentCode: "6", isSystem: false },
  { code: "6.6.01", name: "Impuesto de Renta", type: "EXPENSE", parentCode: "6.6", isSystem: false },
  { code: "6.6.02", name: "Impuesto Municipal", type: "EXPENSE", parentCode: "6.6", isSystem: false },
  { code: "6.6.03", name: "Otros Impuestos y Tasas", type: "EXPENSE", parentCode: "6.6", isSystem: false },
];

/** Revisa la integridad del catálogo (códigos, jerarquía y cuentas que el sistema usa). */
export function validateChart(chart: SeedAccount[] = CR_CHART_OF_ACCOUNTS): string[] {
  const problems: string[] = [];
  const codes = new Set<string>();
  for (const account of chart) {
    if (codes.has(account.code)) problems.push(`Código duplicado: ${account.code}`);
    codes.add(account.code);
    const depth = account.code.split(".").length;
    if (depth > 4) problems.push(`Código con más de 4 niveles: ${account.code}`);
    if (account.parentCode && !chart.some((a) => a.code === account.parentCode)) {
      problems.push(`Cuenta ${account.code} apunta a un padre inexistente: ${account.parentCode}`);
    }
    if (account.parentCode && !account.code.startsWith(`${account.parentCode}.`)) {
      problems.push(`Cuenta ${account.code} no cuelga del prefijo de su padre ${account.parentCode}`);
    }
  }
  for (const [name, code] of Object.entries(REQUIRED_SYSTEM_CODES)) {
    const account = chart.find((a) => a.code === code);
    if (!account) problems.push(`Falta la cuenta requerida ${name} (${code})`);
    else if (!account.isSystem) problems.push(`La cuenta requerida ${code} debe ser isSystem`);
    else if (chart.some((a) => a.parentCode === code)) problems.push(`La cuenta requerida ${code} no debe tener hijas`);
  }
  return problems;
}

/**
 * Aplica el plan de cuentas a un hotel. Es idempotente e incremental: crea solo
 * las cuentas que faltan (por código) y respeta las que ya existen, así que
 * también sirve para completar un plan parcial.
 *
 * Inserta en un solo `createMany` con ids generados, así aplicarlo al dar de
 * alta un hotel no cuesta 160 viajes a la base.
 *
 * Retorna la cantidad de cuentas creadas.
 */
export async function seedChartOfAccounts(prisma: any, hotelId: string): Promise<number> {
  const existing = await prisma.accountingAccount.findMany({
    where: { hotelId },
    select: { id: true, code: true },
  });
  const idByCode = new Map<string, string>(existing.map((a: any) => [a.code, a.id] as [string, string]));

  const now = new Date();
  const rows: any[] = [];
  for (const account of CR_CHART_OF_ACCOUNTS) {
    if (idByCode.has(account.code)) continue;
    const id = randomUUID();
    idByCode.set(account.code, id);
    rows.push({
      id,
      hotelId,
      code: account.code,
      name: account.name,
      type: account.type,
      isSystem: account.isSystem,
      description: account.description ?? null,
      parentId: account.parentCode ? (idByCode.get(account.parentCode) ?? null) : null,
      updatedAt: now,
    });
  }

  if (rows.length > 0) {
    await prisma.accountingAccount.createMany({ data: rows, skipDuplicates: true });
  }

  // Solo cuando el hotel ya tenía cuentas puede haber jerarquías incompletas:
  // en un plan nuevo los parentId ya vienen asignados y no hace falta reparar.
  if (existing.length === 0) return rows.length;

  const parentCodes = Array.from(
    new Set(CR_CHART_OF_ACCOUNTS.map((a) => a.parentCode).filter((c): c is string => Boolean(c)))
  );
  for (const parentCode of parentCodes) {
    const parentId = idByCode.get(parentCode);
    if (!parentId) continue;
    const children = CR_CHART_OF_ACCOUNTS.filter((a) => a.parentCode === parentCode).map((a) => a.code);
    await prisma.accountingAccount.updateMany({
      where: { hotelId, code: { in: children }, parentId: null },
      data: { parentId },
    });
  }

  return rows.length;
}
