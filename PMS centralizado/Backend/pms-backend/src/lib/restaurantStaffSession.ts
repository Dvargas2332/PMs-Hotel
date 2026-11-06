/**
 * Sesión de personal de restaurante (cajeros y meseros).
 *
 * El login de staff emite un token corto independiente del JWT del PMS. Las
 * acciones sensibles del POS (cobrar, anular, descuentos, cambiar precios) se
 * validan contra el AppRole asignado al staff, no contra lo que diga el body.
 *
 * Compatibilidad: si el staff no tiene perfil asignado, o si el POS no manda
 * token, se mantiene la autorización actual del usuario del PMS.
 */

import type { Request } from "express";
import { sign, verify } from "./jwt.js";
import prisma from "./prisma.js";
import type { AuthUser } from "../middleware/auth.js";

export const STAFF_TOKEN_HEADER = "x-staff-token";
const STAFF_TOKEN_TTL = "12h";

export interface StaffSession {
  staffId: string;
  hotelId: string;
  staffRole: "CASHIER" | "WAITER";
  name: string;
}

interface StaffTokenPayload {
  type?: string;
  sub?: string;
  hotelId?: string;
  staffRole?: string;
  name?: string;
}

export function issueStaffToken(session: StaffSession): string {
  return sign(
    {
      type: "restaurant_staff",
      sub: session.staffId,
      hotelId: session.hotelId,
      staffRole: session.staffRole,
      name: session.name,
    },
    { expiresIn: STAFF_TOKEN_TTL }
  );
}

export function readStaffSession(req: Request): StaffSession | null {
  const header = req.headers[STAFF_TOKEN_HEADER];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token) return null;
  try {
    const payload = verify<StaffTokenPayload>(String(token));
    if (payload?.type !== "restaurant_staff") return null;
    const staffRole = String(payload.staffRole || "").toUpperCase();
    if (staffRole !== "CASHIER" && staffRole !== "WAITER") return null;
    if (!payload.sub || !payload.hotelId) return null;
    return {
      staffId: String(payload.sub),
      hotelId: String(payload.hotelId),
      staffRole,
      name: String(payload.name || ""),
    };
  } catch {
    return null;
  }
}

export async function getStaffPermissions(
  hotelId: string,
  staffId: string
): Promise<{ permissions: string[]; hasProfile: boolean } | null> {
  const staff = await prisma.restaurantStaff.findFirst({
    where: { id: staffId, hotelId, active: true },
    select: { accessRoleId: true },
  });
  if (!staff) return null;
  if (!staff.accessRoleId) return { permissions: [], hasProfile: false };
  const granted = await prisma.rolePermission.findMany({
    where: { hotelId, roleId: staff.accessRoleId },
    select: { permissionId: true },
  });
  return { permissions: granted.map((g) => g.permissionId), hasProfile: true };
}

async function userHasPermissions(user: AuthUser, permissions: string[]): Promise<boolean> {
  if (String(user.role || "").toUpperCase() === "ADMIN") return true;
  if (!user.hotelId) return false;
  const granted = await prisma.rolePermission.findFirst({
    where: { hotelId: user.hotelId, roleId: user.role, permissionId: { in: permissions } },
    select: { id: true },
  });
  return Boolean(granted);
}

export interface StaffAuthorization {
  /** Sesión de staff válida leída del header, si existe. */
  session: StaffSession | null;
  /** true si puede ejecutar la acción. */
  allowed: boolean;
  /** Motivo para el 403. */
  reason?: string;
}

/**
 * Autoriza una acción del POS. Con token de staff manda el perfil del staff;
 * sin token (o sin perfil asignado) se conserva la regla del usuario del PMS.
 */
export async function authorizeStaffAction(
  req: Request,
  user: AuthUser,
  permissions: string[]
): Promise<StaffAuthorization> {
  const session = readStaffSession(req);
  if (!session || session.hotelId !== user.hotelId) {
    return { session: null, allowed: await userHasPermissions(user, permissions) };
  }

  const staffPermissions = await getStaffPermissions(session.hotelId, session.staffId);
  if (staffPermissions === null) {
    return { session, allowed: false, reason: "La sesión de personal ya no es válida." };
  }
  if (!staffPermissions.hasProfile) {
    // Staff sin perfil asignado: se rige por el usuario del PMS (legado).
    return { session, allowed: await userHasPermissions(user, permissions) };
  }
  const allowed = permissions.some((p) => staffPermissions.permissions.includes(p));
  return {
    session,
    allowed,
    reason: allowed ? undefined : "Tu perfil de personal no permite esta acción.",
  };
}
