import prisma from "./prisma.js";

export async function nextHotelSequence(hotelId: string, key: string) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.hotelSequence.findFirst({
      where: { hotelId, key },
      select: { id: true, nextNumber: true },
    });
    if (!existing) {
      const created = await tx.hotelSequence.create({
        data: { hotelId, key, nextNumber: 2 },
        select: { nextNumber: true },
      });
      return created.nextNumber - 1;
    }
    await tx.hotelSequence.updateMany({
      where: { id: existing.id, hotelId },
      data: { nextNumber: { increment: 1 } },
    });
    return existing.nextNumber;
  });
  return Number(result);
}

export function padNumber(n: number, width = 6) {
  const s = String(Math.max(0, Math.trunc(n)));
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

