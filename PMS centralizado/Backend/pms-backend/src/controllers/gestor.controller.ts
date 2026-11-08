// src/controllers/gestor.controller.ts
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import ExcelJS from "exceljs";
import prisma from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { ALL_PERMISSIONS, PERMISSION_MODULES } from "../config/permissions.js";
import { allowedModulesForMembership, isMembershipTier, normalizeMembershipTier } from "../config/membership.js";
import { nextHotelSequence, padNumber } from "../lib/sequences.js";
import { DEFAULT_PRINT_FORMS, normalizeGlobalPrintForms } from "../lib/printForms.js";
import { processFormInfo, type FormPayload } from "./forminfo.controller.js";
import { sendGestorMail, buildTestEmail, buildBillingEmail, buildPasswordChangedEmail } from "../lib/mailer.js";
import { sendUserInvite } from "../lib/userInvites.js";
import { seedChartOfAccounts } from "./accounting.seed.js";
import { invalidateMembershipCache } from "../middleware/membership.js";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

/** Quién ejecuta la acción en el gestor (el token del gestor siempre es `sub: "gestor"`). */
function actorOf(req: Request) {
  const user = (req as any)?.user;
  return String(user?.email || user?.sub || "gestor");
}

/** Bitácora de acciones del gestor. Nunca rompe la operación si falla el registro. */
async function logSaasAction(opts: {
  actor: string;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}) {
  try {
    await prisma.saasAuditLog.create({
      data: {
        actor: opts.actor,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId ?? null,
        detail: (opts.detail ?? undefined) as any,
      },
    });
  } catch (err: any) {
    console.warn("[gestor.audit] no se pudo registrar la acción:", err?.message || err);
  }
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pickFirst(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const v = normalizeText(row[key]);
    if (v) return v;
  }
  return "";
}

function buildMembershipPermissions(membership: string) {
  const allowed = new Set(allowedModulesForMembership(membership));
  return Array.from(
    new Set(
      PERMISSION_MODULES.filter((m) => allowed.has(m.id))
        .flatMap((m) => [m.access.id, ...m.permissions.map((p) => p.id)])
    )
  );
}

function parseCsv(content: string) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const firstLine = lines[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === "\"") {
        if (inQuotes && line[i + 1] === "\"") {
          cur += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };

  const headers = parseLine(lines[0]).map((h) => normalizeHeader(h));
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseLine(lines[i]);
    if (!values.some((v) => normalizeText(v))) continue;
    const row: any = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

const SAAS_CONFIG_KEY = "GLOBAL";

function normalizeSmtpPayload(body: any, existing: any) {
  const src = body && typeof body === "object" ? body : {};
  const smtp = src.smtp && typeof src.smtp === "object" ? src.smtp : src;
  const next: any = {};

  if ("host" in smtp) next.host = normalizeText(smtp.host);
  if ("port" in smtp) {
    const p = Number(smtp.port || 0);
    next.port = Number.isFinite(p) && p > 0 ? p : null;
  }
  if ("user" in smtp) next.user = normalizeText(smtp.user);
  if ("secure" in smtp) next.secure = Boolean(smtp.secure);
  if ("from" in smtp) next.from = normalizeText(smtp.from);
  if ("to" in smtp) next.to = normalizeText(smtp.to);
  if ("replyTo" in smtp) next.replyTo = normalizeText(smtp.replyTo);

  const clearPass = Boolean(smtp.clearPass);
  if (clearPass) {
    next.pass = null;
  } else if ("pass" in smtp && String(smtp.pass || "").trim().length > 0) {
    next.pass = String(smtp.pass || "").trim();
  } else if (existing?.pass) {
    next.pass = existing.pass;
  }

  return next;
}

async function parseXlsx(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  let headers: string[] = [];
  const rows: any[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
    const values = Array.isArray(row.values) ? (row.values as any[]).slice(1) : [];
    if (rowIndex === 1) {
      headers = values.map((v) => normalizeHeader(v));
      return;
    }
    if (!headers.length) return;
    if (!values.some((v) => normalizeText(v))) return;

    const out: any = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      const cell = values[idx];
      out[h] = cell == null ? "" : normalizeText(cell);
    });
    rows.push(out);
  });
  return rows;
}

async function readUploadRows(req: Request) {
  // @ts-ignore
  const file = req.file as { buffer?: Buffer; originalname?: string; mimetype?: string } | undefined;
  if (!file?.buffer) return [];
  const fileName = normalizeText(file.originalname).toLowerCase();
  const mime = normalizeText(file.mimetype).toLowerCase();
  const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || mime.includes("spreadsheet") || mime.includes("excel");
  if (isExcel) {
    try {
      return await parseXlsx(file.buffer);
    } catch {
      // Fallback to CSV parsing when the binary is not a valid XLSX.
    }
  }
  const content = file.buffer.toString("utf8");
  return parseCsv(content);
}

type ImportTarget = { id: string; name: string };

/**
 * Resuelve el hotel destino del parámetro `:id`. Ninguna importación debe
 * escribir si el hotel no existe: el gestor elige el destino en la pantalla y
 * el backend responde con ese mismo hotel para que la pantalla lo confirme.
 */
async function resolveImportTarget(req: Request, res: Response): Promise<ImportTarget | null> {
  const hotelId = normalizeText(req.params.id);
  if (!hotelId) {
    res.status(400).json({ message: "Hotel requerido" });
    return null;
  }
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { id: true, name: true },
  });
  if (!hotel) {
    res.status(404).json({ message: "El hotel indicado no existe: elegí el hotel destino antes de subir el archivo" });
    return null;
  }
  return { id: hotel.id, name: hotel.name };
}

async function ensureFamilyCode(hotelId: string, familyId: string) {
  const existing = await prisma.restaurantFamily.findFirst({
    where: { id: familyId, hotelId },
    select: { id: true, code: true },
  });
  if (!existing) throw new Error("Familia no encontrada");
  if (existing.code) return existing.code;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const seq = await nextHotelSequence(hotelId, "restaurant_family_code");
    const code = padNumber(seq, 3);
    try {
      const written = await prisma.restaurantFamily.updateMany({
        where: { id: existing.id, hotelId, code: null },
        data: { code },
      });
      if (written.count === 0) {
        const fresh = await prisma.restaurantFamily.findFirst({ where: { id: existing.id, hotelId }, select: { code: true } });
        if (fresh?.code) return fresh.code;
      } else {
        return code;
      }
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("No se pudo asignar el codigo de familia");
}

async function ensureSubFamilyCode(hotelId: string, subFamilyId: string) {
  const existing = await prisma.restaurantSubFamily.findFirst({
    where: { id: subFamilyId, hotelId },
    select: { id: true, familyId: true, code: true },
  });
  if (!existing) throw new Error("Subfamilia no encontrada");
  if (existing.code) return existing.code;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const seq = await nextHotelSequence(hotelId, `restaurant_subfamily_code:${existing.familyId}`);
    const code = padNumber(seq, 2);
    try {
      const written = await prisma.restaurantSubFamily.updateMany({
        where: { id: existing.id, hotelId, code: null },
        data: { code },
      });
      if (written.count === 0) {
        const fresh = await prisma.restaurantSubFamily.findFirst({ where: { id: existing.id, hotelId }, select: { code: true } });
        if (fresh?.code) return fresh.code;
      } else {
        return code;
      }
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("No se pudo asignar el codigo de subfamilia");
}

async function ensureSubSubFamilyCode(hotelId: string, subSubFamilyId: string) {
  const existing = await prisma.restaurantSubSubFamily.findFirst({
    where: { id: subSubFamilyId, hotelId },
    select: { id: true, subFamilyId: true, code: true },
  });
  if (!existing) throw new Error("SubSubfamilia no encontrada");
  if (existing.code) return existing.code;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const seq = await nextHotelSequence(hotelId, `restaurant_subsubfamily_code:${existing.subFamilyId}`);
    const code = padNumber(seq, 2);
    try {
      const written = await prisma.restaurantSubSubFamily.updateMany({
        where: { id: existing.id, hotelId, code: null },
        data: { code },
      });
      if (written.count === 0) {
        const fresh = await prisma.restaurantSubSubFamily.findFirst({ where: { id: existing.id, hotelId }, select: { code: true } });
        if (fresh?.code) return fresh.code;
      } else {
        return code;
      }
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("No se pudo asignar el codigo de subsubfamilia");
}

function buildItemPrefix(familyCode: string, subFamilyCode?: string | null, subSubFamilyCode?: string | null) {
  return [familyCode, subFamilyCode || null, subSubFamilyCode || null].filter(Boolean).join(".");
}

async function nextRestaurantItemCode(hotelId: string, prefix: string) {
  const seq = await nextHotelSequence(hotelId, `restaurant_item_code:${prefix}`);
  return `${prefix}-${padNumber(seq, 4)}`;
}

export async function listClients(_req: Request, res: Response) {
  const list = await prisma.saasClient.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { hotels: true } } },
  });
  res.json(
    list.map((c) => ({
      id: c.id,
      name: c.name,
      companyId: c.companyId,
      email: c.email,
      phone1: c.phone1,
      phone2: c.phone2,
      ownerName: c.ownerName,
      managerName: c.managerName,
      managerId: c.managerId,
      createdAt: c.createdAt,
      hotelsCount: c._count.hotels,
    }))
  );
}

export async function createClient(req: Request, res: Response) {
  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const name = String(body.name || "").trim();
  if (!name) return res.status(400).json({ message: "Nombre del cliente requerido" });

  const companyId = body.companyId ? String(body.companyId).trim() : null;
  // Un cliente es la empresa dueña de uno o más hoteles: no debe duplicarse.
  const duplicate = await prisma.saasClient.findFirst({
    where: {
      OR: [{ name: { equals: name, mode: "insensitive" } }, ...(companyId ? [{ companyId }] : [])],
    },
    select: { id: true, name: true, companyId: true },
  });
  if (duplicate) {
    return res.status(409).json({
      message:
        duplicate.companyId && duplicate.companyId === companyId
          ? `Ya existe un cliente con esa identificación (${duplicate.name}).`
          : `Ya existe un cliente con ese nombre (${duplicate.name}).`,
      clientId: duplicate.id,
    });
  }

  const created = await prisma.saasClient.create({
    data: {
      name,
      companyId,
      email: body.email ? String(body.email).trim() : null,
      phone1: body.phone1 ? String(body.phone1).trim() : null,
      phone2: body.phone2 ? String(body.phone2).trim() : null,
      ownerName: body.ownerName ? String(body.ownerName).trim() : null,
      managerName: body.managerName ? String(body.managerName).trim() : null,
      managerId: body.managerId ? String(body.managerId).trim() : null,
    },
  });
  await logSaasAction({
    actor: actorOf(req),
    action: "CLIENT_CREATE",
    entity: "client",
    entityId: created.id,
    detail: { name: created.name, companyId: created.companyId },
  });
  res.status(201).json(created);
}

export async function updateClient(req: Request, res: Response) {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "Cliente requerido" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  if (body.name) data.name = normalizeText(body.name);
  if ("companyId" in body) data.companyId = body.companyId ? normalizeText(body.companyId) : null;
  if ("email" in body) data.email = body.email ? normalizeText(body.email) : null;
  if ("phone1" in body) data.phone1 = body.phone1 ? normalizeText(body.phone1) : null;
  if ("phone2" in body) data.phone2 = body.phone2 ? normalizeText(body.phone2) : null;
  if ("ownerName" in body) data.ownerName = body.ownerName ? normalizeText(body.ownerName) : null;
  if ("managerName" in body) data.managerName = body.managerName ? normalizeText(body.managerName) : null;
  if ("managerId" in body) data.managerId = body.managerId ? normalizeText(body.managerId) : null;

  if (Object.keys(data).length === 0) return res.status(400).json({ message: "Sin cambios" });

  const duplicate = await prisma.saasClient.findFirst({
    where: {
      id: { not: id },
      OR: [
        ...(data.name ? [{ name: { equals: data.name, mode: "insensitive" as const } }] : []),
        ...(data.companyId ? [{ companyId: data.companyId }] : []),
      ],
    },
    select: { id: true, name: true },
  });
  if (duplicate) {
    return res.status(409).json({ message: `Ya existe otro cliente con esos datos (${duplicate.name}).` });
  }

  const updated = await prisma.saasClient.update({ where: { id }, data });
  await logSaasAction({
    actor: actorOf(req),
    action: "CLIENT_UPDATE",
    entity: "client",
    entityId: id,
    detail: { fields: Object.keys(data) },
  });
  res.json(updated);
}

export async function deleteClient(req: Request, res: Response) {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "Cliente requerido" });

  const hotelsCount = await prisma.hotel.count({ where: { clientId: id } });
  if (hotelsCount > 0) {
    return res.status(409).json({
      message: "No se puede eliminar el cliente porque tiene hoteles asociados.",
      hotelsCount,
    });
  }

  const client = await prisma.saasClient.findUnique({ where: { id }, select: { name: true } });
  await prisma.saasClient.delete({ where: { id } });
  await logSaasAction({
    actor: actorOf(req),
    action: "CLIENT_DELETE",
    entity: "client",
    entityId: id,
    detail: { name: client?.name ?? null },
  });
  res.json({ ok: true });
}

export async function listHotels(_req: Request, res: Response) {
  const list = await prisma.hotel.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      name: true,
      membership: true,
      currency: true,
      membershipMonthlyFee: true,
      active: true,
      suspendedAt: true,
      createdAt: true,
      clientId: true,
      saasClient: { select: { name: true } },
      phone1: true,
      phone2: true,
      ownerName: true,
      managerName: true,
      companyId: true,
      managerId: true,
      // Usuario principal (login por correo) y estado de su invitación, para no
      // tener que abrir la ficha de cada hotel.
      users: {
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { email: true, inviteSentAt: true, inviteExpiresAt: true, inviteTokenHash: true },
      },
    },
  });
  const now = Date.now();
  res.json(
    list.map((h) => {
      const principal = h.users?.[0] ?? null;
      const invitePending = Boolean(
        principal?.inviteTokenHash && principal?.inviteExpiresAt && principal.inviteExpiresAt.getTime() > now
      );
      return {
        id: h.id,
        number: h.number,
        name: h.name,
        membership: h.membership,
        currency: h.currency,
        membershipMonthlyFee: Number(h.membershipMonthlyFee || 0),
        active: h.active,
        suspendedAt: h.suspendedAt,
        createdAt: h.createdAt,
        saasClientId: h.clientId,
        saasClientName: h.saasClient?.name,
        phone1: h.phone1,
        phone2: h.phone2,
        ownerName: h.ownerName,
        managerName: h.managerName,
        companyId: h.companyId,
        managerId: h.managerId,
        principalEmail: principal?.email ?? null,
        invitePending,
        inviteSentAt: principal?.inviteSentAt ?? null,
        inviteExpiresAt: principal?.inviteExpiresAt ?? null,
      };
    })
  );
}

export async function deleteHotel(req: Request, res: Response) {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "Hotel requerido" });

  const hotel = await prisma.hotel.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });

  const [
    roomsCount,
    roomTypesCount,
    reservationsCount,
    usersCount,
    guestsCount,
    invoicesCount,
    restaurantOrdersCount,
    restaurantItemsCount,
    paymentsCount,
  ] = await prisma.$transaction([
    prisma.room.count({ where: { hotelId: id } }),
    prisma.roomType.count({ where: { hotelId: id } }),
    prisma.reservation.count({ where: { hotelId: id } }),
    prisma.user.count({ where: { hotelId: id } }),
    prisma.guest.count({ where: { hotelId: id } }),
    prisma.invoice.count({ where: { hotelId: id } }),
    prisma.restaurantOrder.count({ where: { hotelId: id } }),
    prisma.restaurantItem.count({ where: { hotelId: id } }),
    prisma.payment.count({ where: { hotelId: id } }),
  ]);

  const usage = {
    roomsCount,
    roomTypesCount,
    reservationsCount,
    usersCount,
    guestsCount,
    invoicesCount,
    restaurantOrdersCount,
    restaurantItemsCount,
    paymentsCount,
  };

  const hasUsage = Object.values(usage).some((n) => Number(n) > 0);
  if (hasUsage) {
    return res.status(409).json({
      message: "No se puede eliminar el hotel porque tiene datos asociados.",
      usage,
    });
  }

  try {
    await prisma.hotel.delete({ where: { id } });
    await logSaasAction({
      actor: actorOf(req),
      action: "HOTEL_DELETE",
      entity: "hotel",
      entityId: id,
      detail: { name: hotel.name },
    });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return res.status(409).json({ message: "No se puede eliminar el hotel por relaciones activas." });
    }
    console.error("deleteHotel error", err);
    res.status(500).json({ message: "No se pudo eliminar el hotel." });
  }
}

async function findPrimaryAdminUser(hotelId: string) {
  return prisma.user.findFirst({
    where: { hotelId, role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, createdAt: true },
  });
}

async function findPrimaryLauncherAdmin(hotelId: string) {
  return prisma.launcherAccount.findFirst({
    where: { hotelId, roleId: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, username: true, email: true, createdAt: true },
  });
}

export async function getHotelAdmin(req: Request, res: Response) {
  const hotelId = String(req.params.id || "").trim();
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true } });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });

  const admin = await findPrimaryAdminUser(hotelId);
  if (!admin) return res.status(404).json({ message: "Administrador principal no encontrado" });
  res.json(admin);
}

export async function updateHotelAdmin(req: Request, res: Response) {
  const hotelId = String(req.params.id || "").trim();
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true, name: true } });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });

  const admin = await findPrimaryAdminUser(hotelId);
  if (!admin) return res.status(404).json({ message: "Administrador principal no encontrado" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};
  let emailChanged = false;
  let passwordChanged = false;

  if ("name" in body) {
    const name = normalizeText(body.name);
    if (!name) return res.status(400).json({ message: "Nombre requerido" });
    data.name = name;
  }

  if ("email" in body) {
    const email = normalizeText(body.email).toLowerCase();
    if (!email) return res.status(400).json({ message: "Email requerido" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Email inválido" });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== admin.id) {
      return res.status(409).json({ message: "Email ya registrado" });
    }
    emailChanged = email !== admin.email.toLowerCase();
    data.email = email;
  }

  if ("password" in body) {
    const password = String(body.password || "");
    if (password && password.length < 4) {
      return res.status(400).json({ message: "Contraseña inválida (min 4)" });
    }
    if (password) {
      data.password = await bcrypt.hash(password, ROUNDS);
      passwordChanged = true;
    }
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Sin cambios" });
  }

  // Si cambia el correo o se fija una contraseña, la invitación pendiente deja
  // de ser válida: el enlace viejo ya no debe servir para tomar la cuenta.
  if (emailChanged || passwordChanged) {
    data.inviteTokenHash = null;
    data.inviteExpiresAt = null;
  }

  const updated = await prisma.user.update({
    where: { id: admin.id },
    data,
    select: { id: true, name: true, email: true, createdAt: true },
  });

  await logSaasAction({
    actor: actorOf(req),
    action: "HOTEL_ADMIN_UPDATE",
    entity: "hotel",
    entityId: hotelId,
    detail: { emailChanged, passwordChanged, email: updated.email },
  });

  // Aviso al hotel cuando el gestor cambia la contraseña del usuario principal.
  if (passwordChanged) {
    try {
      const mail = buildPasswordChangedEmail({
        hotelName: hotel.name,
        userName: updated.name || updated.email,
        changedAt: new Date().toLocaleString("es-CR"),
      });
      await sendGestorMail({ to: updated.email, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (err: any) {
      console.warn("[gestor.updateHotelAdmin] no se pudo enviar el aviso de contraseña:", err?.message || err);
      return res.json({ ...updated, emailSent: false, emailError: err?.message || "No se pudo enviar el aviso" });
    }
    return res.json({ ...updated, emailSent: true });
  }

  res.json(updated);
}

export async function getHotelLauncherAdmin(req: Request, res: Response) {
  const hotelId = String(req.params.id || "").trim();
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true } });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });

  const admin = await findPrimaryLauncherAdmin(hotelId);
  if (!admin) return res.status(404).json({ message: "Administrador de launcher no encontrado" });
  res.json(admin);
}

export async function updateHotelLauncherAdmin(req: Request, res: Response) {
  const hotelId = String(req.params.id || "").trim();
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true } });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });

  const admin = await findPrimaryLauncherAdmin(hotelId);
  if (!admin) return res.status(404).json({ message: "Administrador de launcher no encontrado" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};

  if ("name" in body) {
    const name = normalizeText(body.name);
    if (!name) return res.status(400).json({ message: "Nombre requerido" });
    data.name = name;
  }

  if ("username" in body) {
    const username = normalizeText(body.username).toLowerCase();
    if (!username) return res.status(400).json({ message: "Usuario requerido" });
    const existing = await prisma.launcherAccount.findFirst({
      where: { hotelId, username },
      select: { id: true },
    });
    if (existing && existing.id !== admin.id) {
      return res.status(409).json({ message: "Usuario ya registrado" });
    }
    data.username = username;
  }

  if ("email" in body) {
    const raw = normalizeText(body.email).toLowerCase();
    if (raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return res.status(400).json({ message: "Email inválido" });
    }
    data.email = raw || null;
  }

  if ("password" in body) {
    const password = String(body.password || "");
    if (password && password.length < 4) {
      return res.status(400).json({ message: "Contraseña inválida (min 4)" });
    }
    if (password) {
      data.password = await bcrypt.hash(password, ROUNDS);
    }
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Sin cambios" });
  }

  const updated = await prisma.launcherAccount.update({
    where: { id: admin.id },
    data,
    select: { id: true, name: true, username: true, email: true, createdAt: true },
  });

  await logSaasAction({
    actor: actorOf(req),
    action: "HOTEL_LAUNCHER_ADMIN_UPDATE",
    entity: "hotel",
    entityId: hotelId,
    detail: { fields: Object.keys(data), username: updated.username },
  });

  res.json(updated);
}

export async function createHotel(req: Request, res: Response) {
  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};

  const clientId = String(body.clientId || "").trim();
  if (!clientId) return res.status(400).json({ message: "Cliente requerido" });
  const client = await prisma.saasClient.findUnique({ where: { id: clientId } });
  if (!client) return res.status(404).json({ message: "Cliente no encontrado" });

  const name = String(body.name || "").trim();
  if (!name) return res.status(400).json({ message: "Nombre del hotel requerido" });

  const membershipRaw = String(body.membership || "").trim();
  if (!isMembershipTier(membershipRaw)) {
    return res.status(400).json({ message: "Membresia invalida" });
  }
  const membership = normalizeMembershipTier(membershipRaw);

  const adminUsername = String(body.adminUsername || body.adminEmail || "").trim().toLowerCase();
  const adminPassword = String(body.adminPassword || "");
  const adminName = String(body.adminName || "Administrador").trim();
  const adminEmailRaw = String(body.adminContactEmail || "").trim().toLowerCase();
  const adminEmail = adminEmailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmailRaw) ? adminEmailRaw : null;
  if (!adminUsername) return res.status(400).json({ message: "Usuario del administrador requerido" });
  if (!adminPassword || adminPassword.length < 4) {
    return res.status(400).json({ message: "Contrase??a del administrador inv??lida" });
  }

  const membershipMonthlyFee = Number(body.membershipMonthlyFee || 0);
  const currency = String(body.currency || "CRC").trim().toUpperCase() || "CRC";

  const hotelUserName = String(body.hotelUserName || "Usuario principal").trim();
  const hotelUserEmail = String(body.hotelUserEmail || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hotelUserEmail)) {
    return res.status(400).json({ message: "Correo real del usuario principal requerido (ahí llega la invitación)" });
  }

  const created = await prisma.$transaction(
    async (tx) => {
    const createdHotel = await tx.hotel.create({
      data: {
        name,
        membership,
        currency,
        membershipMonthlyFee,
        clientId,
        phone1: body.phone1 ? String(body.phone1).trim() : null,
        phone2: body.phone2 ? String(body.phone2).trim() : null,
        ownerName: body.ownerName ? String(body.ownerName).trim() : null,
        managerName: body.managerName ? String(body.managerName).trim() : null,
        companyId: body.companyId ? String(body.companyId).trim() : null,
        managerId: body.managerId ? String(body.managerId).trim() : null,
      },
    });

    await tx.permission.createMany({
      data: ALL_PERMISSIONS.map((p) => ({ id: p, description: p })),
      skipDuplicates: true,
    });
    const rolePermissions = buildMembershipPermissions(membership);
    await tx.appRole.upsert({
      where: { hotelId_id: { hotelId: createdHotel.id, id: "ADMIN" } },
      update: { name: "ADMIN", description: "Administrador" },
      create: { id: "ADMIN", name: "ADMIN", description: "Administrador", hotelId: createdHotel.id },
    });
    await tx.rolePermission.deleteMany({ where: { hotelId: createdHotel.id, roleId: "ADMIN" } });
    await tx.rolePermission.createMany({
      data: rolePermissions.map((p) => ({ roleId: "ADMIN", permissionId: p, hotelId: createdHotel.id })),
      skipDuplicates: true,
    });

    const launcherHash = await bcrypt.hash(adminPassword, ROUNDS);
    await tx.launcherAccount.create({
      data: {
        username: adminUsername,
        name: adminName || "Administrador",
        email: adminEmail,
        password: launcherHash,
        roleId: "ADMIN",
        hotelId: createdHotel.id,
      },
    });

    // Catálogos base para que el hotel quede operable desde el primer día:
    // impuestos del restaurante/habitación, configuración del POS y contabilidad
    // con su plan de cuentas.
    await tx.tax.createMany({
      data: [
        { hotelId: createdHotel.id, code: "IVA13", name: "IVA 13%", percent: 13, kind: "IVA", scope: "restaurant", active: true },
        { hotelId: createdHotel.id, code: "SERV10", name: "Servicio 10%", percent: 10, kind: "SERVICE", scope: "restaurant", active: true },
        { hotelId: createdHotel.id, code: "IVA13-H", name: "IVA 13% (habitación)", percent: 13, kind: "IVA", scope: "room", active: true },
      ],
      skipDuplicates: true,
    });

    await tx.restaurantConfig.create({
      data: {
        hotelId: createdHotel.id,
        kitchenPrinter: "",
        barPrinter: "",
        taxes: { iva: 13, servicio: 10, descuentoMax: 15, permitirDescuentos: true, impuestoIncluido: true } as any,
        payments: {
          monedaBase: currency,
          monedaSec: "USD",
          cargoHabitacion: true,
          cobros: ["Efectivo", "Tarjeta"],
          paymentMethods: [],
        } as any,
        general: { inventoryEnabled: true } as any,
      },
    });

    await tx.accountingSettings.create({
      data: { hotelId: createdHotel.id, country: "CR", autoPost: false, fiscalPeriods: false, integrations: {} },
    });
    await seedChartOfAccounts(tx, createdHotel.id);

    if (await tx.user.findUnique({ where: { email: hotelUserEmail } })) {
      throw new Error("Email ya registrado para usuario del hotel");
    }
    // Contraseña aleatoria: el usuario real la define desde la invitación.
    const hotelUserHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), ROUNDS);
    const principalUser = await tx.user.create({
      data: {
        name: hotelUserName,
        email: hotelUserEmail,
        password: hotelUserHash,
        role: "ADMIN",
        hotelId: createdHotel.id,
      },
      select: { id: true },
    });

    return { hotel: createdHotel, principalUserId: principalUser.id };
    },
    // El alta siembra catálogos (impuestos, config del POS y 161 cuentas
    // contables), así que necesita más margen que el timeout por defecto.
    { maxWait: 10_000, timeout: 30_000 }
  );

  const invite = await sendUserInvite({
    userId: created.principalUserId,
    email: hotelUserEmail,
    name: hotelUserName,
    hotelName: created.hotel.name,
  });

  await logSaasAction({
    actor: actorOf(req),
    action: "HOTEL_CREATE",
    entity: "hotel",
    entityId: created.hotel.id,
    detail: {
      name: created.hotel.name,
      number: created.hotel.number,
      membership: created.hotel.membership,
      clientId,
      principalEmail: hotelUserEmail,
      launcherUsername: adminUsername,
    },
  });

  res.status(201).json({
    hotel: created.hotel,
    credentials: {
      hotelUser: {
        email: hotelUserEmail,
        inviteUrl: invite.inviteUrl,
        inviteExpiresAt: invite.expiresAt,
        emailSent: invite.emailSent,
        emailError: invite.emailError || null,
      },
      launcherAdmin: { username: adminUsername, password: adminPassword },
    },
  });
}
export async function updateHotel(req: Request, res: Response) {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "Hotel requerido" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};

  if (body.name) data.name = normalizeText(body.name);
  if (body.currency) data.currency = normalizeText(body.currency).toUpperCase();
  if ("membership" in body) {
    if (!isMembershipTier(body.membership)) return res.status(400).json({ message: "Membresia invalida" });
    data.membership = normalizeMembershipTier(body.membership);
  }
  if ("membershipMonthlyFee" in body) data.membershipMonthlyFee = Number(body.membershipMonthlyFee || 0);
  if ("clientId" in body) {
    const clientId = body.clientId ? normalizeText(body.clientId) : null;
    if (clientId) {
      const client = await prisma.saasClient.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) return res.status(400).json({ message: "El cliente indicado no existe" });
    }
    data.clientId = clientId;
  }
  if ("phone1" in body) data.phone1 = body.phone1 ? normalizeText(body.phone1) : null;
  if ("phone2" in body) data.phone2 = body.phone2 ? normalizeText(body.phone2) : null;
  if ("ownerName" in body) data.ownerName = body.ownerName ? normalizeText(body.ownerName) : null;
  if ("managerName" in body) data.managerName = body.managerName ? normalizeText(body.managerName) : null;
  if ("companyId" in body) data.companyId = body.companyId ? normalizeText(body.companyId) : null;
  if ("managerId" in body) data.managerId = body.managerId ? normalizeText(body.managerId) : null;
  if ("active" in body) {
    data.active = Boolean(body.active);
    data.suspendedAt = data.active ? null : new Date();
  }

  if (Object.keys(data).length === 0) return res.status(400).json({ message: "Sin cambios" });

  const current = await prisma.hotel.findUnique({
    where: { id },
    select: { membership: true, active: true, name: true },
  });
  if (!current) return res.status(404).json({ message: "Hotel no encontrado" });

  const membershipChanged = Boolean(data.membership && data.membership !== current.membership);
  const suspensionChanged = "active" in data && data.active !== current.active;

  const updated = await prisma.$transaction(
    async (tx) => {
      const hotel = await tx.hotel.update({ where: { id }, data });

      // Cambiar de membresía reescribe los permisos del rol ADMIN: si no, el
      // hotel queda con el catálogo del plan anterior.
      if (membershipChanged) {
        await tx.permission.createMany({
          data: ALL_PERMISSIONS.map((p) => ({ id: p, description: p })),
          skipDuplicates: true,
        });
        await tx.rolePermission.deleteMany({ where: { hotelId: id, roleId: "ADMIN" } });
        await tx.rolePermission.createMany({
          data: buildMembershipPermissions(hotel.membership).map((p) => ({
            roleId: "ADMIN",
            permissionId: p,
            hotelId: id,
          })),
          skipDuplicates: true,
        });
      }

      return hotel;
    },
    { maxWait: 10_000, timeout: 20_000 }
  );

  if (membershipChanged || suspensionChanged) invalidateMembershipCache(id);

  await logSaasAction({
    actor: actorOf(req),
    action: suspensionChanged ? (data.active ? "HOTEL_ACTIVATE" : "HOTEL_SUSPEND") : "HOTEL_UPDATE",
    entity: "hotel",
    entityId: id,
    detail: {
      name: updated.name,
      fields: Object.keys(data).filter((k) => k !== "suspendedAt"),
      previousMembership: membershipChanged ? current.membership : undefined,
      membership: membershipChanged ? updated.membership : undefined,
    },
  });

  res.json(updated);
}

/** (Re)genera y envía la invitación al usuario principal (login por correo). */
export async function resendHotelInvite(req: Request, res: Response) {
  const hotelId = String(req.params.id || "").trim();
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true, name: true } });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });

  const user = await prisma.user.findFirst({
    where: { hotelId, role: "ADMIN", NOT: { email: { endsWith: "@pms.local" } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return res.status(404).json({ message: "Este hotel no tiene usuario principal con correo real" });
  }

  const invite = await sendUserInvite({
    userId: user.id,
    email: user.email,
    name: user.name,
    hotelName: hotel.name,
  });

  await logSaasAction({
    actor: actorOf(req),
    action: "HOTEL_INVITE_RESEND",
    entity: "hotel",
    entityId: hotelId,
    detail: { email: user.email, emailSent: invite.emailSent },
  });

  res.json({
    email: user.email,
    inviteUrl: invite.inviteUrl,
    inviteExpiresAt: invite.expiresAt,
    emailSent: invite.emailSent,
    emailError: invite.emailError || null,
  });
}

export async function listHotelBilling(req: Request, res: Response) {
  const hotelId = String(req.params.id || "").trim();
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });

  const list = await prisma.saasBillingPayment.findMany({
    where: { hotelId },
    orderBy: { paidAt: "desc" },
  });
  res.json(
    list.map((p) => ({
      id: p.id,
      hotelId: p.hotelId,
      amount: Number(p.amount || 0),
      currency: p.currency,
      paidAt: p.paidAt,
      note: p.note,
      createdAt: p.createdAt,
    }))
  );
}

export async function createHotelBilling(req: Request, res: Response) {
  const hotelId = String(req.params.id || "").trim();
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const amount = Number(body.amount || 0);
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ message: "Monto inválido" });
  const currency = String(body.currency || "USD").trim().toUpperCase() || "USD";
  const paidAtRaw = String(body.paidAt || "").trim();
  const paidAt = new Date(paidAtRaw);
  if (!paidAtRaw || Number.isNaN(paidAt.getTime())) {
    return res.status(400).json({ message: "Fecha inválida" });
  }

  const created = await prisma.saasBillingPayment.create({
    data: {
      hotelId,
      amount,
      currency,
      paidAt,
      note: body.note ? String(body.note).trim() : null,
    },
  });
  res.status(201).json(created);
}

/** Envía por correo el aviso de un cobro registrado a la dirección del hotel. */
export async function sendHotelBillingEmail(req: Request, res: Response) {
  const hotelId = String(req.params.id || "").trim();
  const paymentId = String(req.params.paymentId || "").trim();
  if (!hotelId || !paymentId) return res.status(400).json({ message: "Parametros requeridos" });

  const payment = await prisma.saasBillingPayment.findFirst({ where: { id: paymentId, hotelId } });
  if (!payment) return res.status(404).json({ message: "Cobro no encontrado" });

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { name: true } });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });

  // Destinatario: el usuario principal del hotel; si no tiene, el correo del launcher.
  const admin = await prisma.user.findFirst({
    where: { hotelId, role: "ADMIN" },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  const launcher = await prisma.launcherAccount.findFirst({
    where: { hotelId, roleId: "ADMIN" },
    select: { email: true },
  });
  const to = String(admin?.email || launcher?.email || "").trim();
  if (!to || to.endsWith("@pms.local")) {
    return res.status(400).json({ message: "El hotel no tiene un correo de contacto válido" });
  }

  const month = payment.paidAt.toLocaleDateString("es-CR", { year: "numeric", month: "long" });
  const mail = buildBillingEmail({
    hotelName: hotel.name,
    month,
    amount: Number(payment.amount || 0),
    currency: payment.currency,
    note: payment.note || undefined,
  });

  try {
    const sent: any = await sendGestorMail({ to, ...mail });
    await logSaasAction({
      actor: String((req as any).user?.email || (req as any).user?.sub || "gestor"),
      action: "billing.email",
      entity: "SaasBillingPayment",
      entityId: payment.id,
      detail: { to, month },
    });
    return res.json({ sent: true, to, providerId: sent?.id ?? null });
  } catch (err: any) {
    return res.status(502).json({ message: err?.message || "No se pudo enviar el correo del cobro" });
  }
}

export async function deleteHotelBilling(req: Request, res: Response) {
  const hotelId = String(req.params.id || "").trim();
  const paymentId = String(req.params.paymentId || "").trim();
  if (!hotelId || !paymentId) return res.status(400).json({ message: "Parametros requeridos" });

  await prisma.saasBillingPayment.deleteMany({ where: { id: paymentId, hotelId } });
  res.json({ ok: true });
}

export async function importRooms(req: Request, res: Response) {
  const target = await resolveImportTarget(req, res);
  if (!target) return;
  const hotelId = target.id;
  const rows = await readUploadRows(req);
  if (!rows.length) return res.status(400).json({ message: "Archivo vacío" });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const addError = (rowIdx: number, message: string) => {
    skipped += 1;
    if (errors.length < 50) errors.push({ row: rowIdx + 2, message });
  };

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx] as any;
    const number = normalizeText(row.number || row.room || row.roomnumber);
    const type = normalizeText(row.type || row.roomtype || row.tipo);
    if (!number || !type) {
      addError(idx, !number ? "Número de habitación requerido" : "Tipo de habitación requerido");
      continue;
    }
    const statusRaw = normalizeText(row.status || "AVAILABLE").toUpperCase();
    const baseRate = Number(row.baserate || row.rate || row.precio || 0);
    const notes = row.notes ? normalizeText(row.notes) : undefined;

    const result = await prisma.room.upsert({
      where: { hotelId_number: { hotelId, number } },
      create: {
        hotelId,
        number,
        type,
        status: statusRaw as any,
        baseRate,
        notes,
      },
      update: {
        type,
        status: statusRaw as any,
        baseRate,
        notes,
      },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1;
    else updated += 1;
  }
  res.json({ hotelId: target.id, hotelName: target.name, rows: rows.length, created, updated, skipped, errors });
}

export async function importGuests(req: Request, res: Response) {
  const target = await resolveImportTarget(req, res);
  if (!target) return;
  const hotelId = target.id;
  const rows = await readUploadRows(req);
  if (!rows.length) return res.status(400).json({ message: "Archivo vacío" });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const addError = (rowIdx: number, message: string) => {
    skipped += 1;
    if (errors.length < 50) errors.push({ row: rowIdx + 2, message });
  };

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx] as any;
    const firstName = normalizeText(row.firstname || row.first_name || row.nombre);
    const lastName = normalizeText(row.lastname || row.last_name || row.apellido);
    if (!firstName && !lastName) {
      addError(idx, "Nombre y apellido vacíos");
      continue;
    }
    const email = row.email ? normalizeText(row.email) : undefined;
    const phone = row.phone ? normalizeText(row.phone) : undefined;

    if (email) {
      const existing = await prisma.guest.findFirst({ where: { hotelId, email } });
      if (existing) {
        await prisma.guest.update({ where: { id: existing.id }, data: { firstName, lastName, phone } });
        updated += 1;
      } else {
        await prisma.guest.create({ data: { hotelId, firstName, lastName, email, phone } });
        created += 1;
      }
    } else {
      await prisma.guest.create({ data: { hotelId, firstName, lastName, phone } });
      created += 1;
    }
  }
  res.json({ hotelId: target.id, hotelName: target.name, rows: rows.length, created, updated, skipped, errors });
}

export async function importReservations(req: Request, res: Response) {
  const target = await resolveImportTarget(req, res);
  if (!target) return;
  const hotelId = target.id;
  const rows = await readUploadRows(req);
  if (!rows.length) return res.status(400).json({ message: "Archivo vacío" });

  let created = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const addError = (rowIdx: number, message: string) => {
    skipped += 1;
    if (errors.length < 50) errors.push({ row: rowIdx + 2, message });
  };

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx] as any;
    const roomNumber = normalizeText(row.roomnumber || row.room || row.habitacion);
    const guestEmail = normalizeText(row.guestemail || row.email);
    const guestFirst = normalizeText(row.guestfirstname || row.firstname || row.nombre);
    const guestLast = normalizeText(row.guestlastname || row.lastname || row.apellido);
    const checkInRaw = normalizeText(row.checkin || row.check_in);
    const checkOutRaw = normalizeText(row.checkout || row.check_out);
    if (!roomNumber || !checkInRaw || !checkOutRaw) {
      addError(idx, "Faltan habitación, check-in o check-out");
      continue;
    }

    const room = await prisma.room.findFirst({ where: { hotelId, number: roomNumber } });
    if (!room) {
      addError(idx, `La habitación ${roomNumber} no existe en el hotel`);
      continue;
    }

    let guest = null;
    if (guestEmail) {
      guest = await prisma.guest.findFirst({ where: { hotelId, email: guestEmail } });
    }
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          hotelId,
          firstName: guestFirst || "Guest",
          lastName: guestLast || "",
          email: guestEmail || null,
        },
      });
    }

    const checkIn = new Date(checkInRaw);
    const checkOut = new Date(checkOutRaw);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      addError(idx, "Fecha de check-in o check-out inválida");
      continue;
    }

    const code = `IMP-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    await prisma.reservation.create({
      data: {
        code,
        roomId: room.id,
        guestId: guest.id,
        checkIn,
        checkOut,
        hotelId,
        status: "CONFIRMED" as any,
      },
    });
    created += 1;
  }
  res.json({ hotelId: target.id, hotelName: target.name, rows: rows.length, created, updated: 0, skipped, errors });
}

export async function importRestaurantItems(req: Request, res: Response) {
  const target = await resolveImportTarget(req, res);
  if (!target) return;
  const hotelId = target.id;
  const rows = await readUploadRows(req);
  if (!rows.length) return res.status(400).json({ message: "Archivo vacio" });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const hasOwn = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
  const addError = (rowIdx: number, message: string) => {
    skipped += 1;
    if (errors.length < 50) errors.push({ row: rowIdx + 2, message });
  };

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx] as any;
    try {
      const name = pickFirst(row, [
        "name",
        "nombre",
        "item",
        "item_name",
        "itemname",
        "nombre_item",
        "nombre_articulo",
        "articulo",
        "producto",
        "descripcion",
        "description",
        "descripcion_articulo",
      ]);
      if (!name) {
        addError(idx, "Nombre requerido");
        continue;
      }

      const familyName =
        pickFirst(row, ["family", "familia", "family_name", "familyname", "categoria", "category", "grupo", "group"]) ||
        "General";
      const subFamilyName = pickFirst(row, [
        "subfamily",
        "subfamilia",
        "sub_family",
        "sub_familia",
        "sub_family_name",
        "sub_familia_name",
        "subfamily_name",
        "subfamilia_name",
        "subfamilia_nombre",
        "sub_familia_nombre",
        "subcategory",
        "subcategoria",
        "sub_group",
      ]);
      const subSubFamilyName = pickFirst(row, [
        "subsubfamily",
        "subsubfamilia",
        "subsub_familia",
        "sub_subfamily",
        "sub_subfamilia",
        "sub_sub_familia",
        "sub_sub_family",
        "sub_subfamily_name",
        "sub_subfamilia_name",
        "sub_sub_familia_name",
        "subsubfamily_name",
        "subsubfamilia_name",
        "subsub_familia_name",
        "sub_subfamilia",
        "sub_subcategoria",
      ]);

      const cabys = pickFirst(row, [
        "cabys",
        "cabyscode",
        "cabys_code",
        "codigo_cabys",
        "cabys_codigo",
        "codigo_cabys_familia",
        "cabys_familia",
      ]);
      const hasBarcodeColumn = [
        "barcode",
        "codigo",
        "codigo_barra",
        "codigo_barras",
        "codigo_de_barras",
        "codigo_barra_opcional",
        "barcode2",
        "barcode_optional",
        "code2",
        "codigo2",
        "barras",
      ].some((k) => hasOwn(row, k));
      const barcodeRaw = pickFirst(row, [
        "barcode",
        "codigo",
        "codigo_barra",
        "codigo_barras",
        "codigo_de_barras",
        "codigo_barra_opcional",
        "barcode2",
        "barcode_optional",
        "code2",
        "codigo2",
        "barras",
      ]);
      const barcode = barcodeRaw ? barcodeRaw : null;

      const internalCode = pickFirst(row, [
        "item_code",
        "itemcode",
        "item_id",
        "itemid",
        "internal_code",
        "code_internal",
        "codigo_interno",
        "code",
        "codigo",
        "sku",
      ]);

      const price = Number(pickFirst(row, ["price", "precio", "pvp", "unit_price", "sale_price", "precio_venta"]) || 0);

      let family = await prisma.restaurantFamily.findFirst({ where: { hotelId, name: familyName } });
      if (!family) {
        if (!cabys) {
          addError(idx, "CABYS requerido para crear la familia");
          continue;
        }
        family = await prisma.restaurantFamily.create({
          data: {
            hotelId,
            name: familyName,
            code: null,
            cabys,
          },
        });
      } else if (cabys && !family.cabys) {
        family = await prisma.restaurantFamily.update({
          where: { id: family.id },
          data: { cabys },
        });
      }

      if (!family?.cabys) {
        addError(idx, "CABYS requerido para la familia");
        continue;
      }

      let subFamily: any = null;
      if (subFamilyName) {
        subFamily = await prisma.restaurantSubFamily.findFirst({
          where: { hotelId, familyId: family.id, name: subFamilyName },
        });
        if (!subFamily) {
          subFamily = await prisma.restaurantSubFamily.create({
            data: { hotelId, familyId: family.id, name: subFamilyName, code: null },
          });
        }
      }

      let subSubFamily: any = null;
      if (subSubFamilyName) {
        if (!subFamily) {
          addError(idx, "Subfamilia requerida para subsubfamilia");
          continue;
        }
        subSubFamily = await prisma.restaurantSubSubFamily.findFirst({
          where: { hotelId, subFamilyId: subFamily.id, name: subSubFamilyName },
        });
        if (!subSubFamily) {
          subSubFamily = await prisma.restaurantSubSubFamily.create({
            data: { hotelId, subFamilyId: subFamily.id, name: subSubFamilyName, code: null },
          });
        }
      }

      let existing: any = null;
      if (internalCode) {
        existing = await prisma.restaurantItem.findFirst({ where: { hotelId, code: internalCode } });
      }
      if (!existing && barcode) {
        existing = await prisma.restaurantItem.findFirst({ where: { hotelId, barcode } });
      }
      if (!existing) {
        existing = await prisma.restaurantItem.findFirst({
          where: {
            hotelId,
            name,
            familyId: family.id,
            subFamilyId: subFamily?.id || null,
            subSubFamilyId: subSubFamily?.id || null,
          },
        });
      }

      // Fallback para imports antiguos que crearon articulos sin subfamilia/subsubfamilia.
      if (!existing) {
        const sameNameInFamily = await prisma.restaurantItem.findMany({
          where: { hotelId, name, familyId: family.id },
          orderBy: { createdAt: "asc" },
          take: 2,
        });
        if (sameNameInFamily.length === 1) {
          existing = sameNameInFamily[0];
        }
      }

      if (existing) {
        const data: any = {
          name,
          price,
          familyId: family.id,
          subFamilyId: subFamily?.id || null,
          subSubFamilyId: subSubFamily?.id || null,
          cabys: family.cabys,
        };
        if (hasBarcodeColumn) data.barcode = barcode;
        if (internalCode && internalCode !== existing.code) data.code = internalCode;

        await prisma.restaurantItem.updateMany({
          where: { id: existing.id, hotelId },
          data,
        });
        updated += 1;
      } else {
        const number = await nextHotelSequence(hotelId, "restaurant_item");
        let code = internalCode;
        if (!code) {
          const familyCode = family.code || (await ensureFamilyCode(hotelId, family.id));
          const subFamilyCode = subFamily?.id ? subFamily.code || (await ensureSubFamilyCode(hotelId, subFamily.id)) : null;
          const subSubFamilyCode = subSubFamily?.id
            ? subSubFamily.code || (await ensureSubSubFamilyCode(hotelId, subSubFamily.id))
            : null;
          const prefix = buildItemPrefix(familyCode, subFamilyCode, subSubFamilyCode);
          code = await nextRestaurantItemCode(hotelId, prefix);
        }

        await prisma.restaurantItem.create({
          data: {
            hotelId,
            number,
            code,
            barcode: barcode || null,
            name,
            price,
            familyId: family.id,
            subFamilyId: subFamily?.id || null,
            subSubFamilyId: subSubFamily?.id || null,
            cabys: family.cabys,
          },
        });
        created += 1;
      }
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : "Error inesperado";
      addError(idx, msg);
    }
  }
  res.json({ hotelId: target.id, hotelName: target.name, rows: rows.length, created, updated, skipped, errors });
}

export async function importInventoryItems(req: Request, res: Response) {
  const target = await resolveImportTarget(req, res);
  if (!target) return;
  const hotelId = target.id;
  const rows = await readUploadRows(req);
  if (!rows.length) return res.status(400).json({ message: "Archivo vacío" });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const addError = (rowIdx: number, message: string) => {
    skipped += 1;
    if (errors.length < 50) errors.push({ row: rowIdx + 2, message });
  };

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx] as any;
    const sku = normalizeText(row.sku || row.code || row.codigo);
    const desc = normalizeText(row.desc || row.descripcion || row.name);
    const unit = normalizeText(row.unit || row.unidad || "unit");
    if (!sku || !desc) {
      addError(idx, !sku ? "SKU requerido" : "Descripción requerida");
      continue;
    }
    const cost = Number(row.cost || row.costo || 0);
    const min = Number(row.min || row.minimo || 0);

    const existing = await prisma.restaurantInventoryItem.findFirst({ where: { hotelId, sku } });
    if (existing) {
      await prisma.restaurantInventoryItem.update({
        where: { id: existing.id },
        data: { desc, unit, cost, min },
      });
      updated += 1;
    } else {
      const number = await nextHotelSequence(hotelId, "restaurant_inventory");
      await prisma.restaurantInventoryItem.create({
        data: {
          hotelId,
          number,
          sku,
          desc,
          unit,
          cost,
          min,
        },
      });
      created += 1;
    }
  }
  res.json({ hotelId: target.id, hotelName: target.name, rows: rows.length, created, updated, skipped, errors });
}

export async function importSuppliers(_req: Request, res: Response) {
  return res.status(501).json({
    message:
      "Los proveedores no tienen catálogo propio: se guardan por nombre en cada artículo de inventario o factura. No hay nada que importar por separado.",
  });
}

// Launcher Gestor: reenvio interno a forminfo (sin exponer API key al frontend)
export async function submitFormInfoFromGestor(req: Request, res: Response) {
  const body = (req.body || {}) as FormPayload;
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();

  const result = await processFormInfo(body, ip);
  if (result.status !== 200) return res.status(result.status).json({ message: result.message });
  return res.json({ ok: true });
}

export async function getSaasConfig(_req: Request, res: Response) {
  const config = await prisma.saasConfig.findUnique({ where: { key: SAAS_CONFIG_KEY } });
  const smtp = (config?.smtp || {}) as any;
  const safeSmtp = { ...smtp };
  if ("pass" in safeSmtp) {
    delete safeSmtp.pass;
    safeSmtp.passSet = true;
  }
  res.json({ key: SAAS_CONFIG_KEY, smtp: safeSmtp });
}

export async function updateSaasConfig(req: Request, res: Response) {
  const existing = await prisma.saasConfig.findUnique({ where: { key: SAAS_CONFIG_KEY } });
  const existingSmtp = (existing?.smtp || {}) as any;
  const nextSmtp = normalizeSmtpPayload(req.body, existingSmtp);

  const saved = await prisma.saasConfig.upsert({
    where: { key: SAAS_CONFIG_KEY },
    update: { smtp: nextSmtp },
    create: { key: SAAS_CONFIG_KEY, smtp: nextSmtp },
  });

  const smtp = (saved.smtp || {}) as any;
  const safeSmtp = { ...smtp };
  if ("pass" in safeSmtp) {
    delete safeSmtp.pass;
    safeSmtp.passSet = true;
  }
  res.json({ key: SAAS_CONFIG_KEY, smtp: safeSmtp });
}

export async function getPrintForms(_req: Request, res: Response) {
  const config = await prisma.saasConfig.findUnique({ where: { key: SAAS_CONFIG_KEY } });
  const global = normalizeGlobalPrintForms((config as any)?.printFormsGlobal);
  res.json({ forms: DEFAULT_PRINT_FORMS, global });
}

/** Bitácora de acciones del gestor (últimas N, filtrable por entidad). */
export async function listSaasAudit(req: Request, res: Response) {
  const rawLimit = Number((req.query as any)?.limit ?? 100);
  const limit = Math.min(500, Math.max(1, Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 100));
  const entity = String((req.query as any)?.entity || "").trim();
  const entityId = String((req.query as any)?.entityId || "").trim();

  const list = await prisma.saasAuditLog.findMany({
    where: { ...(entity ? { entity } : {}), ...(entityId ? { entityId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json(list);
}

export async function updateGlobalPrintForms(req: Request, res: Response) {
  const formIds = Array.isArray(req.body?.formIds) ? req.body.formIds : [];
  const modules = req.body?.modules;
  const nextForms = DEFAULT_PRINT_FORMS.filter((f) => formIds.includes(f.id));
  const global = normalizeGlobalPrintForms({ formIds: nextForms.map((f) => f.id), modules });
  const saved = await prisma.saasConfig.upsert({
    where: { key: SAAS_CONFIG_KEY },
    update: { printFormsGlobal: global },
    create: { key: SAAS_CONFIG_KEY, printFormsGlobal: global },
  });
  const savedGlobal = normalizeGlobalPrintForms((saved as any)?.printFormsGlobal);
  res.json({ ok: true, global: savedGlobal });
}

// ── Resend (gestor mailer) ────────────────────────────────────────────────────

export async function getResendConfig(_req: Request, res: Response) {
  const config = await prisma.saasConfig.findUnique({ where: { key: SAAS_CONFIG_KEY } });
  const rc = ((config as any)?.resendConfig || {}) as any;
  const safe = {
    from: rc.from || "",
    replyTo: rc.replyTo || "",
    apiKeySet: Boolean(rc.apiKey),
  };
  res.json(safe);
}

export async function updateResendConfig(req: Request, res: Response) {
  const existing = await prisma.saasConfig.findUnique({ where: { key: SAAS_CONFIG_KEY } });
  const prev = ((existing as any)?.resendConfig || {}) as any;

  const next: any = { ...prev };
  const body = req.body || {};

  if (typeof body.from === "string") next.from = body.from.trim();
  if (typeof body.replyTo === "string") next.replyTo = body.replyTo.trim();
  if (typeof body.apiKey === "string" && body.apiKey.trim()) next.apiKey = body.apiKey.trim();
  if (body.clearApiKey) delete next.apiKey;

  await prisma.saasConfig.upsert({
    where: { key: SAAS_CONFIG_KEY },
    update: { resendConfig: next } as any,
    create: { key: SAAS_CONFIG_KEY, resendConfig: next } as any,
  });

  res.json({ ok: true, apiKeySet: Boolean(next.apiKey), from: next.from || "", replyTo: next.replyTo || "" });
}

export async function sendTestEmail(req: Request, res: Response) {
  const to = String(req.body?.to || "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ message: "Email de destino inválido." });
  }
  try {
    const mail = buildTestEmail(to);
    await sendGestorMail(mail);
    res.json({ ok: true, message: `Correo de prueba enviado a ${to}` });
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err?.message || "Error al enviar correo." });
  }
}

export { sendGestorMail, buildBillingEmail, buildPasswordChangedEmail };
