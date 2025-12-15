// src/schemas/user.schema.ts

import { z } from "zod";

export const resetPasswordSchema = z.object({
  params: z.object({
    id: z.string().min(1, "El id de usuario es requerido"),
  }),
  body: z.object({
    password: z
      .string()
      .min(4, "La contraseña debe tener al menos 4 dígitos")
      .regex(/^\d{4,}$/, "La contraseña debe tener al menos 4 dígitos numéricos"),
  }),
});

