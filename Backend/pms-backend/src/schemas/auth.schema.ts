// src/schemas/auth.schema.ts

import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    name: z.string().min(1),
    // Contraseña de usuario (no PIN): mínimo 4 caracteres
    password: z.string().min(4, "La contraseña debe tener al menos 4 caracteres"),
    hotelName: z.string().min(1).optional(),
  }),
});

// Login acepta email O username (compat), pero se valida contra User.email.
export const loginSchema = z
  .object({
    body: z
      .object({
        email: z.string().optional(),
        username: z.string().optional(),
        password: z.string().min(4, "La contraseña debe tener al menos 4 caracteres"),
      })
      .refine((data) => !!data.email || !!data.username, {
        message: "Debe especificar email o username",
        path: ["email"],
      }),
  });

