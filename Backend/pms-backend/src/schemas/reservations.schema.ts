import { z } from "zod";
export const createReservationSchema = z.object({
body: z.object({
roomId: z.string().cuid(),
guestId: z.string().cuid(),
checkIn: z.string().datetime(),
checkOut: z.string().datetime(),
adults: z.number().int().min(1).max(6).default(2),
children: z.number().int().min(0).max(6).default(0)
})
});