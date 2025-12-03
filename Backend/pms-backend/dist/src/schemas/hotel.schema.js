// src/schemas/hotel.schema.ts
import { z } from "zod";
export const updateHotelSchema = z.object({
    params: z.object({
        hotelId: z.string().min(1).optional(), // opcional, por defecto usamos el del token
    }),
    body: z
        .object({
        name: z.string().min(1).optional(),
        currency: z.string().min(1).optional(),
    })
        .refine((body) => Object.keys(body).length > 0, { message: "Debe enviar al menos un campo a actualizar" }),
});
