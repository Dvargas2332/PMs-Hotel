// prisma/seed.ts

import { PrismaClient, Role, RoomStatus } from "@prisma/client";
import { ALL_PERMISSIONS } from "../src/config/permissions.js";

const prisma = new PrismaClient();

async function main() {
  // usuario y hotel demo
  const hotel = await prisma.hotel.upsert({
    where: { id: "hotel-demo" },
    update: {},
    create: { id: "hotel-demo", name: "Hotel Demo", currency: "CRC" },
  });

  await prisma.user.upsert({
    where: { email: "admin@pms.local" },
    update: {
      // ensure default admin stays usable if seed runs multiple times
      name: "Administrador",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      role: Role.ADMIN,
      hotelId: hotel.id,
    },
    create: {
      email: "admin@pms.local",
      name: "Administrador",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      role: Role.ADMIN,
      hotelId: hotel.id,
    },
  });

  // Super usuario adicional para acceso completo al hotel demo
  await prisma.user.upsert({
    where: { email: "superadmin@pms.local" },
    update: {
      name: "Super Admin",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      role: Role.ADMIN,
      hotelId: hotel.id,
    },
    create: {
      email: "superadmin@pms.local",
      name: "Super Admin",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      role: Role.ADMIN,
      hotelId: hotel.id,
    },
  });

  // permisos base
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id: p },
      update: {},
      create: { id: p, description: p },
    });
  }

  // Roles predefinidos para el hotel demo
  const predefinedRoles = [
    { id: "ADMIN", name: "Admin", description: "Administrador" },
    { id: "RECEPTION", name: "Recepción", description: "Recepción / Front Desk" },
    { id: "ACCOUNTING", name: "Contabilidad", description: "Contabilidad / Finanzas" },
    { id: "RESTAURANT", name: "Restaurante", description: "Operaciones de restaurante" },
  ] as const;

  for (const r of predefinedRoles) {
    await prisma.appRole.upsert({
      where: { hotelId_id: { hotelId: hotel.id, id: r.id } },
      update: { name: r.name, description: r.description },
      create: { id: r.id, name: r.name, description: r.description, hotelId: hotel.id },
    });
  }

  // Asignar permisos a cada rol (todos los permisos para ADMIN, módulos específicos para otros roles)
  await prisma.rolePermission.deleteMany({ where: { hotelId: hotel.id } });

  // Admin: todos los permisos
  await prisma.rolePermission.createMany({
    data: ALL_PERMISSIONS.map((p) => ({ roleId: "ADMIN", permissionId: p, hotelId: hotel.id })),
    skipDuplicates: true,
  });

  // Cuenta de launcher admin por defecto para el hotel demo
  await prisma.launcherAccount.upsert({
    where: { hotelId_username: { hotelId: hotel.id, username: "admin" } },
    update: {
      name: "Admin",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      roleId: "ADMIN",
    },
    create: {
      username: "admin",
      name: "Admin",
      password: "$2b$10$0KtF9XOFKYsJ4bcO/00zDe80npQ7bNy/JX9EY1s/Sh1prLKEvnxQe", // "1234"
      hotelId: hotel.id,
      roleId: "ADMIN",
    },
  });

  // habitaciones
  const roomsData = [
    { number: "101", type: "STD", baseRate: 35000, status: RoomStatus.AVAILABLE, hotelId: hotel.id },
    { number: "102", type: "STD", baseRate: 35000, status: RoomStatus.AVAILABLE, hotelId: hotel.id },
    { number: "201", type: "DELUXE", baseRate: 50000, status: RoomStatus.AVAILABLE, hotelId: hotel.id },
  ];
  for (const r of roomsData) {
    await prisma.room.upsert({
      where: { hotelId_number: { hotelId: hotel.id, number: r.number } },
      update: r,
      create: r,
    });
  }

  // huesped demo
  await prisma.guest.upsert({
    where: { hotelId_email: { hotelId: hotel.id, email: "demo@guest.local" } },
    update: {},
    create: { firstName: "Huesped", lastName: "Demo", email: "demo@guest.local", phone: "7000-0000", hotelId: hotel.id },
  });

  // ===== Catálogo geográfico básico (paises / regiones / ciudades) =====
  try {
    const fs = await import("fs");
    const fileUrl = new URL("./data/world-geo.sample.json", import.meta.url);
    if (fs.existsSync(fileUrl)) {
      const raw = fs.readFileSync(fileUrl, "utf-8");
      const json = JSON.parse(raw) as {
        countries?: { code: string; name: string; regions?: { code?: string; name: string; cities?: string[] }[] }[];
      };
      for (const c of json.countries || []) {
        const country = await prisma.country.upsert({
          where: { code: c.code },
          update: { name: c.name },
          create: { code: c.code, name: c.name },
        });
        for (const r of c.regions || []) {
          const regionId = `${country.code}-${r.code || r.name}`;
          const region = await prisma.region.upsert({
            where: { id: regionId },
            update: { name: r.name, code: r.code || null },
            create: { id: regionId, name: r.name, code: r.code || null, countryCode: country.code },
          });
          for (const cityName of r.cities || []) {
            await prisma.city.upsert({
              where: {
                // combinamos nombre + pais para evitar duplicados simples
                id: `${country.code}-${region.id}-${cityName}`,
              },
              update: { name: cityName },
              create: {
                id: `${country.code}-${region.id}-${cityName}`,
                name: cityName,
                countryCode: country.code,
                regionId: region.id,
              },
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn("No se pudo cargar catalogo geografico:", err);
  }

  console.log("Seed listo:", { hotel: hotel.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
