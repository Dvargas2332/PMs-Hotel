import bcrypt from "bcrypt";
import prisma from "../dist/lib/prisma.js";
import { ALL_PERMISSIONS } from "../dist/config/permissions.js";

const ROUNDS = 10;
const clientId = "cmlq09i0e0000n6e9znhbianh";
const name = "hotel nume 2";
const membership = "HBASIC";
const adminEmail = "numer02.p@admin.com";
const adminPassword = "qwerty";
const adminName = "Administrador";
const currency = "CRC";
const membershipMonthlyFee = 0;

try {
  const hotel = await prisma.$transaction(async (tx) => {
    const createdHotel = await tx.hotel.create({
      data: { name, membership, currency, membershipMonthlyFee, clientId },
    });

    await tx.permission.createMany({
      data: ALL_PERMISSIONS.map((p) => ({ id: p, description: p })),
      skipDuplicates: true,
    });

    await tx.appRole.upsert({
      where: { hotelId_id: { hotelId: createdHotel.id, id: "ADMIN" } },
      update: { name: "ADMIN", description: "Administrador" },
      create: { id: "ADMIN", name: "ADMIN", description: "Administrador", hotelId: createdHotel.id },
    });

    await tx.rolePermission.deleteMany({ where: { hotelId: createdHotel.id, roleId: "ADMIN" } });
    await tx.rolePermission.createMany({
      data: ALL_PERMISSIONS.map((p) => ({ roleId: "ADMIN", permissionId: p, hotelId: createdHotel.id })),
      skipDuplicates: true,
    });

    const hash = await bcrypt.hash(adminPassword, ROUNDS);
    await tx.user.create({
      data: { name: adminName, email: adminEmail, password: hash, role: "ADMIN", hotelId: createdHotel.id },
    });

    return createdHotel;
  });

  console.log(JSON.stringify(hotel));
} catch (e) {
  console.error(e);
} finally {
  await prisma.$disconnect();
}
