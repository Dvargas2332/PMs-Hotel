// src/schemas/user.schema.ts

import { z } from "zod";

const passwordRule = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "La contraseña debe contener al menos una mayúscula")
  .regex(/[a-z]/, "La contraseña debe contener al menos una minúscula")
  .regex(/[0-9]/, "La contraseña debe contener al menos un número");

export const resetPasswordSchema = z.object({
  params: z.object({
    id: z.string().min(1, "El id de usuario es requerido"),
  }),
  body: z.object({
    password: passwordRule,
  }),
});

