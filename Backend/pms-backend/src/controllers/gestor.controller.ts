// src/controllers/gestor.controller.ts
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { ALL_PERMISSIONS, PERMISSION_MODULES } from "../config/permissions.js";
import { allowedModulesForMembership, isMembershipTier, normalizeMembershipTier } from "../config/membership.js";
import { nextHotelSequence } from "../lib/sequences.js";

const ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const DEFAULT_USER_PASSWORD_LEN = 10;

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
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

function generatePassword() {
  const raw = crypto.randomBytes(8).toString("base64url");
  if (raw.length >= DEFAULT_USER_PASSWORD_LEN) return raw.slice(0, DEFAULT_USER_PASSWORD_LEN);
  return `${raw}${crypto.randomBytes(4).toString("hex")}`.slice(0, DEFAULT_USER_PASSWORD_LEN);
}

async function buildUniqueHotelUserEmail(base: string) {
  let email = base.toLowerCase();
  let suffix = 0;
  while (await prisma.user.findUnique({ where: { email } })) {
    suffix += 1;
    email = base.replace("@", `+${suffix}@`).toLowerCase();
    if (suffix > 20) {
      email = `hotel-${crypto.randomBytes(3).toString("hex")}@pms.local`;
      break;
    }
  }
  return email;
}

function parseCsv(content: string) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

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
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseLine(lines[i]);
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function readUploadCsv(req: Request) {
  // @ts-ignore
  const file = req.file as { buffer?: Buffer } | undefined;
  if (!file?.buffer) return [];
  const content = file.buffer.toString("utf8");
  return parseCsv(content);
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

  const created = await prisma.saasClient.create({
    data: {
      name,
      companyId: body.companyId ? String(body.companyId).trim() : null,
      email: body.email ? String(body.email).trim() : null,
      phone1: body.phone1 ? String(body.phone1).trim() : null,
      phone2: body.phone2 ? String(body.phone2).trim() : null,
      ownerName: body.ownerName ? String(body.ownerName).trim() : null,
      managerName: body.managerName ? String(body.managerName).trim() : null,
      managerId: body.managerId ? String(body.managerId).trim() : null,
    },
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

  const updated = await prisma.saasClient.update({ where: { id }, data });
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

  await prisma.saasClient.delete({ where: { id } });
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
      createdAt: true,
      clientId: true,
      saasClient: { select: { name: true } },
      phone1: true,
      phone2: true,
      ownerName: true,
      managerName: true,
      companyId: true,
      managerId: true,
    },
  });
  res.json(
    list.map((h) => ({
      id: h.id,
      number: h.number,
      name: h.name,
      membership: h.membership,
      currency: h.currency,
      membershipMonthlyFee: Number(h.membershipMonthlyFee || 0),
      createdAt: h.createdAt,
      saasClientId: h.clientId,
      saasClientName: h.saasClient?.name,
      phone1: h.phone1,
      phone2: h.phone2,
      ownerName: h.ownerName,
      managerName: h.managerName,
      companyId: h.companyId,
      managerId: h.managerId,
    }))
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
    select: { id: true, name: true, username: true, createdAt: true },
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

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true } });
  if (!hotel) return res.status(404).json({ message: "Hotel no encontrado" });

  const admin = await findPrimaryAdminUser(hotelId);
  if (!admin) return res.status(404).json({ message: "Administrador principal no encontrado" });

  const body = req.body && typeof req.body === "object" ? (req.body as any) : {};
  const data: any = {};

  if ("name" in body) {
    const name = normalizeText(body.name);
    if (!name) return res.status(400).json({ message: "Nombre requerido" });
    data.name = name;
  }

  if ("email" in body) {
    const email = normalizeText(body.email).toLowerCase();
    if (!email) return res.status(400).json({ message: "Email requerido" });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== admin.id) {
      return res.status(409).json({ message: "Email ya registrado" });
    }
    data.email = email;
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

  const updated = await prisma.user.update({
    where: { id: admin.id },
    data,
    select: { id: true, name: true, email: true, createdAt: true },
  });
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
    select: { id: true, name: true, username: true, createdAt: true },
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
  if (!adminUsername) return res.status(400).json({ message: "Usuario del administrador requerido" });
  if (!adminPassword || adminPassword.length < 4) {
    return res.status(400).json({ message: "Contrase??a del administrador inv??lida" });
  }

  const membershipMonthlyFee = Number(body.membershipMonthlyFee || 0);
  const currency = String(body.currency || "CRC").trim().toUpperCase() || "CRC";

  let createdCredentials: any = null;
  const hotel = await prisma.$transaction(async (tx) => {
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
        password: launcherHash,
        roleId: "ADMIN",
        hotelId: createdHotel.id,
      },
    });

    const hotelUserName = String(body.hotelUserName || "Usuario principal").trim();
    const hotelUserEmailRaw = String(body.hotelUserEmail || "").trim().toLowerCase();
    const hotelUserPasswordRaw = String(body.hotelUserPassword || "");
    const hotelUserEmail = hotelUserEmailRaw
      ? hotelUserEmailRaw
      : await buildUniqueHotelUserEmail(`hotel-${createdHotel.number}@pms.local`);
    if (await tx.user.findUnique({ where: { email: hotelUserEmail } })) {
      throw new Error("Email ya registrado para usuario del hotel");
    }
    const hotelUserPassword = hotelUserPasswordRaw || generatePassword();
    if (hotelUserPassword.length < 4) {
      throw new Error("Contrase??a del usuario del hotel inv??lida (min 4)");
    }
    const hotelUserHash = await bcrypt.hash(hotelUserPassword, ROUNDS);
    await tx.user.create({
      data: {
        name: hotelUserName,
        email: hotelUserEmail,
        password: hotelUserHash,
        role: "ADMIN",
        hotelId: createdHotel.id,
      },
    });

    createdCredentials = {
      hotelUser: { email: hotelUserEmail, password: hotelUserPassword },
      launcherAdmin: { username: adminUsername, password: adminPassword },
    };

    return createdHotel;
  });

  res.status(201).json({
    hotel,
    credentials: createdCredentials,
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
  if ("clientId" in body) data.clientId = body.clientId ? normalizeText(body.clientId) : null;
  if ("phone1" in body) data.phone1 = body.phone1 ? normalizeText(body.phone1) : null;
  if ("phone2" in body) data.phone2 = body.phone2 ? normalizeText(body.phone2) : null;
  if ("ownerName" in body) data.ownerName = body.ownerName ? normalizeText(body.ownerName) : null;
  if ("managerName" in body) data.managerName = body.managerName ? normalizeText(body.managerName) : null;
  if ("companyId" in body) data.companyId = body.companyId ? normalizeText(body.companyId) : null;
  if ("managerId" in body) data.managerId = body.managerId ? normalizeText(body.managerId) : null;

  const updated = await prisma.hotel.update({ where: { id }, data });
  res.json(updated);
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

export async function deleteHotelBilling(req: Request, res: Response) {
  const hotelId = String(req.params.id || "").trim();
  const paymentId = String(req.params.paymentId || "").trim();
  if (!hotelId || !paymentId) return res.status(400).json({ message: "Parametros requeridos" });

  await prisma.saasBillingPayment.deleteMany({ where: { id: paymentId, hotelId } });
  res.json({ ok: true });
}

export async function importRooms(req: Request, res: Response) {
  const hotelId = normalizeText(req.params.id);
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });
  const rows = readUploadCsv(req);
  if (!rows.length) return res.status(400).json({ message: "Archivo vacío" });

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const number = normalizeText(row.number || row.room || row.roomnumber);
    const type = normalizeText(row.type || row.roomtype || row.tipo);
    if (!number || !type) continue;
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
  res.json({ created, updated });
}

export async function importGuests(req: Request, res: Response) {
  const hotelId = normalizeText(req.params.id);
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });
  const rows = readUploadCsv(req);
  if (!rows.length) return res.status(400).json({ message: "Archivo vacío" });

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const firstName = normalizeText(row.firstname || row.first_name || row.nombre);
    const lastName = normalizeText(row.lastname || row.last_name || row.apellido);
    if (!firstName && !lastName) continue;
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
  res.json({ created, updated });
}

export async function importReservations(req: Request, res: Response) {
  const hotelId = normalizeText(req.params.id);
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });
  const rows = readUploadCsv(req);
  if (!rows.length) return res.status(400).json({ message: "Archivo vacío" });

  let created = 0;
  for (const row of rows) {
    const roomNumber = normalizeText(row.roomnumber || row.room || row.habitacion);
    const guestEmail = normalizeText(row.guestemail || row.email);
    const guestFirst = normalizeText(row.guestfirstname || row.firstname || row.nombre);
    const guestLast = normalizeText(row.guestlastname || row.lastname || row.apellido);
    const checkInRaw = normalizeText(row.checkin || row.check_in);
    const checkOutRaw = normalizeText(row.checkout || row.check_out);
    if (!roomNumber || !checkInRaw || !checkOutRaw) continue;

    const room = await prisma.room.findFirst({ where: { hotelId, number: roomNumber } });
    if (!room) continue;

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
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) continue;

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
  res.json({ created, updated: 0 });
}

export async function importRestaurantItems(req: Request, res: Response) {
  const hotelId = normalizeText(req.params.id);
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });
  const rows = readUploadCsv(req);
  if (!rows.length) return res.status(400).json({ message: "Archivo vacío" });

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const name = normalizeText(row.name || row.nombre);
    const code = normalizeText(row.code || row.codigo || name);
    const familyName = normalizeText(row.family || row.familia || "General");
    if (!name) continue;

    let family = await prisma.restaurantFamily.findFirst({ where: { hotelId, name: familyName } });
    if (!family) {
      family = await prisma.restaurantFamily.create({
        data: {
          hotelId,
          name: familyName,
          code: null,
        },
      });
    }

    const existing = await prisma.restaurantItem.findFirst({ where: { hotelId, code } });
    const price = Number(row.price || row.precio || 0);

    if (existing) {
      await prisma.restaurantItem.update({
        where: { id: existing.id },
        data: {
          name,
          price,
          familyId: family.id,
        },
      });
      updated += 1;
    } else {
      const number = await nextHotelSequence(hotelId, "restaurant_item");
      await prisma.restaurantItem.create({
        data: {
          hotelId,
          number,
          code,
          name,
          price,
          familyId: family.id,
        },
      });
      created += 1;
    }
  }
  res.json({ created, updated });
}

export async function importInventoryItems(req: Request, res: Response) {
  const hotelId = normalizeText(req.params.id);
  if (!hotelId) return res.status(400).json({ message: "Hotel requerido" });
  const rows = readUploadCsv(req);
  if (!rows.length) return res.status(400).json({ message: "Archivo vacío" });

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const sku = normalizeText(row.sku || row.code || row.codigo);
    const desc = normalizeText(row.desc || row.descripcion || row.name);
    const unit = normalizeText(row.unit || row.unidad || "unit");
    if (!sku || !desc) continue;
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
  res.json({ created, updated });
}

export async function importSuppliers(_req: Request, res: Response) {
  return res.status(501).json({ message: "Importación de proveedores no soportada (no hay modelo de proveedores)." });
}
