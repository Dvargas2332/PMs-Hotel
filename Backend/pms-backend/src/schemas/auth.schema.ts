// src/schemas/auth.schema.ts

import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    name: z.string().min(1),
    // mínimo 4 dígitos numéricos
    password: z
      .string()
      .min(4, "La contraseña debe tener al menos 4 caracteres")
      .regex(/^\d{4,}$/, "La contraseña debe tener al menos 4 dígitos numéricos"),
  }),
});

// Login acepta email O username (para /auth/login y /auth/user-login)
export const loginSchema = z.object({
  body: z
    .object({
      email: z.string().optional(),
      username: z.string().optional(),
      // permitimos cualquier contraseña de longitud >= 4
      password: z.string().min(4, "La contraseña debe tener al menos 4 caracteres"),
    })
    .refine((data) => !!data.email || !!data.username, {
      message: "Debe especificar email o username",
      path: ["email"],
    }),
});

