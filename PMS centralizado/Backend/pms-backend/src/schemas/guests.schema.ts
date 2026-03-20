// src/schemas/guests.schema.ts

import { z } from "zod";

const baseGuestBody = {
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  state: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  legalName: z.string().optional(),
  managerName: z.string().optional(),
  economicActivity: z.string().optional(),
  emailAlt1: z.string().email().optional(),
  emailAlt2: z.string().email().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
};

export const createGuestSchema = z.object({
  body: z.object(baseGuestBody),
});

export const updateGuestSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.object(
    Object.fromEntries(
      Object.entries(baseGuestBody).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])
    ) as Record<string, z.ZodTypeAny>
  ),
});
