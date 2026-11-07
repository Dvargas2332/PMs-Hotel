// src/schemas/auth.schema.ts

import { z } from "zod";

const passwordRule = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "La contraseña debe contener al menos una mayúscula")
  .regex(/[a-z]/, "La contraseña debe contener al menos una minúscula")
  .regex(/[0-9]/, "La contraseña debe contener al menos un número");

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    name: z.string().min(1),
    password: passwordRule,
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
        password: z.string().min(1, "La contraseña es requerida"),
      })
      .refine((data) => !!data.email || !!data.username, {
        message: "Debe especificar email o username",
        path: ["email"],
      }),
  });

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Correo inválido"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(10, "El enlace no es válido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  }),
});

