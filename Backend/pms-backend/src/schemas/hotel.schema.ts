// src/schemas/hotel.schema.ts
import { z } from "zod";

export const updateHotelSchema = z.object({
  params: z.object({
    hotelId: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    currency: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    address: z.string().optional(),
  }),
});
