/**
 * Script de migración de datos:
 * Recalcula subtotal, tax y tip10 para RestaurantOrder en estado PAID
 * usando las tasas globales del hotel (fallback) porque los impuestos
 * por ítem no estaban disponibles históricamente.
 *
 * Ejecutar con: npx tsx scripts/migrateRestaurantOrderTotals.ts
 */

import prisma from "../src/lib/prisma.js";
import { calculateOrderTotals } from "../src/lib/restaurantTaxes.js";

const asNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};

async function getGlobalTaxes(hotelId: string) {
  const cfg = await prisma.restaurantConfig.findUnique({ where: { hotelId }, select: { taxes: true } });
  const taxes = (cfg?.taxes || {}) as any;
  return { iva: asNumber(taxes.iva), servicio: asNumber(taxes.servicio) };
}

async function main() {
  const orders = await prisma.restaurantOrder.findMany({
    where: { status: "PAID" },
    include: { items: true },
  });

  console.log(`Procesando ${orders.length} órdenes pagadas...`);

  const taxesByHotel = new Map<string, { iva: number; servicio: number }>();

  for (const order of orders) {
    let taxes = taxesByHotel.get(order.hotelId);
    if (!taxes) {
      taxes = await getGlobalTaxes(order.hotelId);
      taxesByHotel.set(order.hotelId, taxes);
    }

    const itemsInput = order.items.map((i) => ({
      price: asNumber(i.price),
      qty: asNumber(i.qty),
      discountPercent: asNumber(i.discountPercent),
      priceIncludesTaxesAndService: i.priceIncludesTaxesAndService !== false,
      taxes: null as any, // fallback a globales
    }));

    const totals = calculateOrderTotals(itemsInput, taxes, asNumber(order.discountPercent));

    // Solo actualizar si hay diferencia
    const currentSubtotal = asNumber(order.subtotal);
    const currentTax = asNumber(order.tax);
    const currentTip10 = asNumber(order.tip10);
    if (
      Math.abs(currentSubtotal - totals.subtotal) > 0.01 ||
      Math.abs(currentTax - totals.tax) > 0.01 ||
      Math.abs(currentTip10 - totals.service) > 0.01
    ) {
      await prisma.restaurantOrder.update({
        where: { id: order.id },
        data: {
          subtotal: totals.subtotal,
          tax: totals.tax,
          tip10: totals.service,
        },
      });
      console.log(`  Orden ${order.id}: subtotal=${totals.subtotal} tax=${totals.tax} tip10=${totals.service}`);
    }
  }

  console.log("Migración completada.");
}

main()
  .catch((err) => {
    console.error("Error en migración:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
