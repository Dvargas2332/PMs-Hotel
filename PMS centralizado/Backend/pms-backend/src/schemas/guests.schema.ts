// src/schemas/guests.schema.ts

import { z } from "zod";

/**
 * Un campo de texto vacío cuenta como ausente. Los formularios mandan "" al
 * dejar un campo en blanco, y "" no es un correo válido: sin esto, guardar un
 * cliente sin correo devolvía 400 aunque el correo era opcional.
 */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = z.preprocess(emptyToUndefined, z.string().optional());
const optionalEmail = z.preprocess(emptyToUndefined, z.string().email().optional());

const baseGuestBody = {
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: optionalEmail,
  phone: optionalText,
  state: optionalText,
  idType: optionalText,
  idNumber: optionalText,
  legalName: optionalText,
  managerName: optionalText,
  economicActivity: optionalText,
  emailAlt1: optionalEmail,
  emailAlt2: optionalEmail,
  country: optionalText,
  city: optionalText,
  address: optionalText,
  company: optionalText,
  notes: optionalText,
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
