// src/schemas/reservations.schema.ts


import { z } from "zod";

export const createReservationSchema = z.object({
  body: z
    .object({
      roomId: z.string().cuid(),
      guestId: z.string().cuid(),
      checkIn: z.string(),
      checkOut: z.string(),
      adults: z.number().int().min(1).max(6).default(2),
      children: z.number().int().min(0).max(6).default(0),
      contractId: z.string().optional(),
      ratePlanId: z.string().optional(),
      mealPlanId: z.string().optional(),
      code: z.string().optional(),
      rooming: z.string().optional(),
      otaCode: z.string().optional(),
      source: z.string().optional(),
      notes: z.string().optional(),
    })
    .transform((v) => {
      const inDate = new Date(v.checkIn);
      const outDate = new Date(v.checkOut);
      return {
        ...v,
        checkIn: Number.isNaN(inDate.getTime()) ? v.checkIn : inDate.toISOString(),
        checkOut: Number.isNaN(outDate.getTime()) ? v.checkOut : outDate.toISOString(),
      };
    })
    .refine((v) => new Date(v.checkOut).getTime() > new Date(v.checkIn).getTime(), {
      message: "La salida debe ser posterior a la llegada",
      path: ["checkOut"],
    }),
});
