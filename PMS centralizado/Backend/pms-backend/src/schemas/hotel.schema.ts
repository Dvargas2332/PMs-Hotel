// src/schemas/hotel.schema.ts
import { z } from "zod";
import { MEMBERSHIP_TIERS } from "../config/membership.js";

export const updateHotelSchema = z.object({
  params: z.object({
    hotelId: z.string().min(1).optional(), // opcional, por defecto usamos el del token
  }),
  body: z
    .object({
      name: z.string().min(1).optional(),
      currency: z.string().min(1).optional(),
      membership: z.enum(MEMBERSHIP_TIERS).optional(),
      phone1: z.string().nullable().optional(),
      phone2: z.string().nullable().optional(),
      ownerName: z.string().nullable().optional(),
      managerName: z.string().nullable().optional(),
      companyId: z.string().nullable().optional(),
      managerId: z.string().nullable().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, { message: "Debe enviar al menos un campo a actualizar" }),
});
