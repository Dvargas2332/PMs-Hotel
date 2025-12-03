// src/schemas/guests.schema.ts

import { z } from "zod";
export const createGuestSchema = z.object({ body: z.object({
firstName: z.string().min(1), lastName: z.string().min(1),
email: z.string().email().optional(), phone: z.string().optional()
})});
export const updateGuestSchema = z.object({
params: z.object({ id: z.string().cuid() }),
body: z.object({ firstName: z.string().min(1).optional(), lastName: z.string().min(1).optional(), email: z.string().email().optional(), phone: z.string().optional() })
});