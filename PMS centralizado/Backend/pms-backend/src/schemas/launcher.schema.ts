// src/schemas/launcher.schema.ts

import { z } from "zod";

// Login del launcher (primer login por hotel)
export const launcherLoginSchema = z.object({
  body: z.object({
    username: z.string().min(1, "El usuario es requerido"),
    password: z
      .string()
      .min(4, "La contraseña debe tener al menos 4 dígitos")
      .regex(/^\d{4,}$/, "La contraseña debe tener al menos 4 dígitos numéricos"),
    hotelId: z.string().min(1).optional(),
  }),
});

// Crear cuenta de launcher desde el management
// Campos que pide el recuadro de "Perfiles y permisos":
// - userId: id de usuario (login)
// - name: nombre visible
// - roleId: rol del usuario (obligatorio)
// - password: contraseña (PIN de 4+ dígitos)
export const launcherAccountCreateSchema = z.object({
  body: z.object({
    userId: z.string().min(3, "El id de usuario debe tener al menos 3 caracteres"),
    name: z.string().min(1, "El nombre de usuario es requerido"),
    roleId: z.string().min(1, "El rol es requerido"),
    password: z
      .string()
      .min(4, "La contraseña debe tener al menos 4 dígitos")
      .regex(/^\d{4,}$/, "La contraseña debe tener al menos 4 dígitos numéricos"),
  }),
});

// Actualizar cuenta de launcher desde el management
export const launcherAccountUpdateSchema = z.object({
  params: z.object({
    id: z.string().min(1, "El id es requerido"),
  }),
  body: z.object({
    userId: z.string().min(3).optional(),
    name: z.string().min(1).optional(),
    roleId: z.string().min(1).optional(),
    password: z
      .string()
      .min(4, "La contraseña debe tener al menos 4 dígitos")
      .regex(/^\d{4,}$/, "La contraseña debe tener al menos 4 dígitos numéricos")
      .optional(),
  }),
});

