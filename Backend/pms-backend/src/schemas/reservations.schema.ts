// src/schemas/reservations.schema.ts


import { z } from "zod";

export const createReservationSchema = z.object({
  body: z
    .object({
      roomId: z.string().cuid(),
      guestId: z.string().cuid(),
      checkIn: z.string().datetime(),
      checkOut: z.string().datetime(),
      adults: z.number().int().min(1).max(6).default(2),
      children: z.number().int().min(0).max(6).default(0),
      source: z.string().optional(),
      notes: z.string().optional(),
    })
    .refine((v) => new Date(v.checkOut) > new Date(v.checkIn), {
      message: "La salida debe ser posterior a la llegada",
      path: ["checkOut"],
    }),
});
