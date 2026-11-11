// src/jobs/bccr.cron.ts
//
// Actualiza una vez al día el tipo de cambio de referencia en los hoteles que
// activaron la API del Banco Central. Los que no tienen correo o token se
// saltan sin ruido: la pantalla ya avisa que falta configurarla.
import cron from "node-cron";
import prisma from "../lib/prisma.js";
import { fetchBccrExchangeRate } from "../services/bccr.js";

export function startBccrRateJob() {
  return cron.schedule("10 7 * * *", async () => {
    try {
      const configs = await prisma.restaurantConfig.findMany({
        select: { hotelId: true, payments: true },
      });
      for (const cfg of configs) {
        const payments = (cfg.payments && typeof cfg.payments === "object" ? cfg.payments : {}) as any;
        if (payments.useBCCR !== true) continue;
        const email = String(payments.bccrEmail || "").trim();
        const token = String(payments.bccrToken || "").trim();
        if (!email || !token) continue;
        try {
          const rate = await fetchBccrExchangeRate(email, token);
          await prisma.restaurantConfig.update({
            where: { hotelId: cfg.hotelId },
            data: {
              payments: {
                ...payments,
                tipoCambioCompra: rate.buy,
                tipoCambioVenta: rate.sell,
                tipoCambio: rate.buy,
                bccrLastSync: new Date().toISOString(),
              } as any,
            },
          });
          console.log(`[bccr] hotel ${cfg.hotelId}: compra ${rate.buy} / venta ${rate.sell}`);
        } catch (err) {
          console.warn(`[bccr] hotel ${cfg.hotelId}: no se pudo actualizar el tipo de cambio`, err);
        }
      }
    } catch (err) {
      console.warn("[bccr] no se pudo leer la configuración de los hoteles", err);
    }
  });
}
