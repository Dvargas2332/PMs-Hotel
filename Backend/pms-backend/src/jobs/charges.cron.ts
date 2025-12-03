// src/jobs/charges.cron.ts
import cron from "node-cron";
import { startOfDay, addDays } from "date-fns";
import { prisma } from "../lib/prisma.js";

export function startDailyChargesJob() {
  return cron.schedule("5 0 * * *", async () => {
    const today = startOfDay(new Date());
    try {
      const stays = await prisma.reservation.findMany({
        where: { status: "CHECKED_IN", checkIn: { lte: addDays(today, 1) }, checkOut: { gt: today } },
        include: {
          room: { select: { baseRate: true, currency: true } },
          invoice: { select: { id: true } },
        },
      });

      for (const r of stays) {
        const inv = r.invoice ?? await prisma.invoice.create({
          data: {
            reservationId: r.id,
            guestId: r.guestId,
            number: `INV-${today.toISOString().slice(0,10)}-${r.id.slice(0,6)}`,
            status: "DRAFT",
            ...(r.room?.currency ? { currency: r.room.currency } : {}),
          },
          select: { id: true },
        });

        const invoiceId = inv.id;
        const concept = `Alojamiento ${today.toISOString().slice(0,10)}`;

        const exists = await prisma.invoiceItem.findFirst({
          where: { invoiceId, description: concept },
          select: { id: true },
        });

        if (!exists) {
          const rate = r.room?.baseRate ?? 0;
          await prisma.invoiceItem.create({
            data: { invoiceId, description: concept, unitPrice: rate, total: rate, quantity: 1 },
          });
        }
      }
    } catch (err) {
      console.error("[cron] daily charges job failed:", err);
    }
  });
}
